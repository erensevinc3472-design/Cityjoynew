import {
  bearingDeg,
  distanceKm,
  encodeGeohash,
  isRoadsideKind,
  ROADSIDE_FEATURE_IDS,
  type Business,
  type RoadsideFeature,
  type RoadsideKindId,
} from './business';

/**
 * Yoldayım'daki bir yer: CityJoy'a kayıtlı yol üstü işletme ya da OpenStreetMap'ten gelen akaryakıt istasyonu, şarj
 * noktası, dinlenme tesisi. OSM kaydı "doğrulanmadı" sayılır; aynı yerde işletme kaydı varsa o gösterilir.
 */
export interface RoadsidePlace {
  id: string;
  name: string;
  source: 'isletme' | 'osm';
  geo: { lat: number; lng: number };
  /** Olanaklar; OSM'de etiketlerden çıkar, bilinmeyen eklenmez (boş olabilir). */
  roadside: RoadsideFeature[];
  kind?: RoadsideKindId;
  /** OSM'deki marka (ör. akaryakıt dağıtım şirketi). */
  brand?: string;
  business?: Business;
}

/**
 * OSM paketi kaydı (kısa alan adları: paket küçük kalsın). i: OSM kimliği ("n123", "w456"), n: ad, k: çeşit,
 * a/o: enlem/boylam, f: olanaklar, b: marka.
 */
export interface PackedPlace {
  i: string;
  n: string;
  k: RoadsideKindId;
  a: number;
  o: number;
  f: RoadsideFeature[];
  b?: string;
}

/** Paket hücresi: 3 harflik geohash (yaklaşık 156 x 156 km). Türkiye 60 kadar hücreye sığar. */
export const ROADSIDE_PACK_PRECISION = 3;
/** Bir pakette en çok bu kadar yer (kurallar da denetler). */
export const ROADSIDE_PACK_MAX = 2500;

export function placeOfBusiness(b: Business): RoadsidePlace | null {
  if (b.status !== 'yayinda' || !b.geo || !b.roadside?.length) return null;
  return {
    id: b.id,
    name: b.name,
    source: 'isletme',
    geo: { lat: b.geo.lat, lng: b.geo.lng },
    roadside: b.roadside,
    kind: b.categoryIds.find(isRoadsideKind),
    business: b,
  };
}

export function unpackPlace(p: PackedPlace): RoadsidePlace {
  return {
    id: `osm-${p.i}`,
    name: p.n,
    source: 'osm',
    geo: { lat: p.a, lng: p.o },
    roadside: p.f.filter((x) => ROADSIDE_FEATURE_IDS.includes(x)),
    ...(isRoadsideKind(p.k) ? { kind: p.k } : {}),
    ...(p.b ? { brand: p.b } : {}),
  };
}

/** Yolcunun 40 km çevresine değen paket hücreleri (çoğunlukla 1-4 hücre). */
export function roadsidePackCells(lat: number, lng: number, reachKm = 40): string[] {
  const dLat = reachKm / 111;
  const dLng = reachKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const out = new Set<string>();
  for (const a of [-1, 0, 1]) for (const o of [-1, 0, 1]) out.add(encodeGeohash(lat + a * dLat, lng + o * dLng, ROADSIDE_PACK_PRECISION));
  return [...out];
}

/** OSM yerlerini işletmelerle birleştirir: bir işletmenin 150 m yakınındaki OSM kaydı (aynı yer) atılır. */
export function mergePlaces(businesses: readonly RoadsidePlace[], osm: readonly RoadsidePlace[]): RoadsidePlace[] {
  const keep = osm.filter((p) => !businesses.some((b) => distanceKm(b.geo, p.geo) < 0.15));
  return [...businesses, ...keep];
}

/** Paketleri hücreye göre gruplar (panelde yükleme; betikteki dosyadan). */
export function packByCell(list: readonly PackedPlace[]): Map<string, PackedPlace[]> {
  const out = new Map<string, PackedPlace[]>();
  for (const p of list) {
    const cell = encodeGeohash(p.a, p.o, ROADSIDE_PACK_PRECISION);
    const arr = out.get(cell) ?? [];
    arr.push(p);
    out.set(cell, arr);
  }
  return out;
}

export interface RoadsideStop {
  place: RoadsidePlace;
  km: number;
  /** Gidiş yönüne göre: ileride, yakında (2 km içinde, yön fark etmez) ya da geride. Yön bilinmiyorsa "yakinda" / "ileride". */
  where: 'ileride' | 'yakinda' | 'geride';
}

/**
 * Yoldayım: yerleri ihtiyaca göre süzer ve sıralar. Yön biliniyorsa (heading) gidilen yönün ±70° içindekiler
 * "ileride"; 2 km içindekiler her zaman gösterilir; geride kalanlar listenin sonuna gider. maxKm dışındakiler atılır.
 * İhtiyaç seçiliyse olanağı bilinmeyen (boş) yer gösterilmez. Eşit mesafede işletme kaydı OSM'den önce gelir.
 */
export function rankRoadsideStops(
  list: readonly RoadsidePlace[],
  at: { lat: number; lng: number },
  opts: { need?: readonly RoadsideFeature[]; heading?: number | null; maxKm?: number } = {},
): RoadsideStop[] {
  const maxKm = opts.maxKm ?? 40;
  const stops: RoadsideStop[] = [];
  for (const p of list) {
    if (opts.need?.length && !opts.need.some((n) => p.roadside.includes(n))) continue;
    const km = distanceKm(at, p.geo);
    if (km > maxKm) continue;
    let where: RoadsideStop['where'] = km <= 2 ? 'yakinda' : 'ileride';
    if (km > 2 && opts.heading != null) {
      const diff = Math.abs(((bearingDeg(at, p.geo) - opts.heading + 540) % 360) - 180);
      if (diff > 70) where = 'geride';
    }
    stops.push({ place: p, km, where });
  }
  const order = { yakinda: 0, ileride: 0, geride: 1 } as const;
  return stops.sort((x, y) => order[x.where] - order[y.where] || x.km - y.km || Number(y.place.source === 'isletme') - Number(x.place.source === 'isletme'));
}
