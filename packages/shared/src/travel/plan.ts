import { distanceKm } from '../business/business';
import type { RoadsidePlace } from '../business/roadside';

/**
 * Seyahat > Planla (PROJE.md 5.2, "Yolculuk Planı"; Eren onayladı 29 Ekim 2026): tek ekran, bilgi odaklı. Ücretli harita
 * servisi kullanılmaz: mesafe il merkezleri arasından hesaplanır, ücretler panelden ayda bir girilen fiyatlarla tahmin
 * edilir ve her yerde "tahmini" diye yazılır.
 */

/** İl merkezlerinin yaklaşık koordinatları (valilik / şehir merkezi). */
export const PROVINCE_CENTERS: Record<string, { lat: number; lng: number }> = {
  '01': { lat: 37.0, lng: 35.3213 }, '02': { lat: 37.7648, lng: 38.2786 }, '03': { lat: 38.7507, lng: 30.5567 },
  '04': { lat: 39.7191, lng: 43.0503 }, '05': { lat: 40.6499, lng: 35.8353 }, '06': { lat: 39.9334, lng: 32.8597 },
  '07': { lat: 36.8969, lng: 30.7133 }, '08': { lat: 41.1828, lng: 41.8183 }, '09': { lat: 37.856, lng: 27.8416 },
  '10': { lat: 39.6484, lng: 27.8826 }, '11': { lat: 40.1451, lng: 29.9799 }, '12': { lat: 38.8847, lng: 40.4939 },
  '13': { lat: 38.4006, lng: 42.1095 }, '14': { lat: 40.735, lng: 31.6061 }, '15': { lat: 37.7203, lng: 30.2908 },
  '16': { lat: 40.1885, lng: 29.061 }, '17': { lat: 40.1553, lng: 26.4142 }, '18': { lat: 40.6013, lng: 33.6134 },
  '19': { lat: 40.5506, lng: 34.9556 }, '20': { lat: 37.7765, lng: 29.0864 }, '21': { lat: 37.9144, lng: 40.2306 },
  '22': { lat: 41.6771, lng: 26.5557 }, '23': { lat: 38.681, lng: 39.2264 }, '24': { lat: 39.75, lng: 39.5 },
  '25': { lat: 39.9043, lng: 41.2679 }, '26': { lat: 39.7767, lng: 30.5206 }, '27': { lat: 37.0662, lng: 37.3833 },
  '28': { lat: 40.9128, lng: 38.3895 }, '29': { lat: 40.4603, lng: 39.4814 }, '30': { lat: 37.5744, lng: 43.7408 },
  '31': { lat: 36.2021, lng: 36.16 }, '32': { lat: 37.7648, lng: 30.5566 }, '33': { lat: 36.8121, lng: 34.6415 },
  '34': { lat: 41.0082, lng: 28.9784 }, '35': { lat: 38.4237, lng: 27.1428 }, '36': { lat: 40.6013, lng: 43.0975 },
  '37': { lat: 41.3887, lng: 33.7827 }, '38': { lat: 38.7312, lng: 35.4787 }, '39': { lat: 41.7333, lng: 27.2167 },
  '40': { lat: 39.1425, lng: 34.1709 }, '41': { lat: 40.7654, lng: 29.9408 }, '42': { lat: 37.8746, lng: 32.4932 },
  '43': { lat: 39.4167, lng: 29.9833 }, '44': { lat: 38.3552, lng: 38.3095 }, '45': { lat: 38.6191, lng: 27.4289 },
  '46': { lat: 37.5858, lng: 36.9371 }, '47': { lat: 37.3212, lng: 40.7245 }, '48': { lat: 37.2153, lng: 28.3636 },
  '49': { lat: 38.9462, lng: 41.7539 }, '50': { lat: 38.6939, lng: 34.6857 }, '51': { lat: 37.9667, lng: 34.6833 },
  '52': { lat: 40.9839, lng: 37.8764 }, '53': { lat: 41.0201, lng: 40.5234 }, '54': { lat: 40.694, lng: 30.4358 },
  '55': { lat: 41.2928, lng: 36.3313 }, '56': { lat: 37.9333, lng: 41.95 }, '57': { lat: 42.0231, lng: 35.1531 },
  '58': { lat: 39.7477, lng: 37.0179 }, '59': { lat: 40.9833, lng: 27.5167 }, '60': { lat: 40.3167, lng: 36.55 },
  '61': { lat: 41.0015, lng: 39.7178 }, '62': { lat: 39.1079, lng: 39.5401 }, '63': { lat: 37.1591, lng: 38.7969 },
  '64': { lat: 38.6823, lng: 29.4082 }, '65': { lat: 38.4891, lng: 43.4089 }, '66': { lat: 39.8181, lng: 34.8147 },
  '67': { lat: 41.4564, lng: 31.7987 }, '68': { lat: 38.3687, lng: 34.037 }, '69': { lat: 40.2552, lng: 40.2249 },
  '70': { lat: 37.1759, lng: 33.2287 }, '71': { lat: 39.8468, lng: 33.5153 }, '72': { lat: 37.8812, lng: 41.1351 },
  '73': { lat: 37.5164, lng: 42.4611 }, '74': { lat: 41.6344, lng: 32.3375 }, '75': { lat: 41.1105, lng: 42.7022 },
  '76': { lat: 39.9237, lng: 44.045 }, '77': { lat: 40.65, lng: 29.2667 }, '78': { lat: 41.2061, lng: 32.6204 },
  '79': { lat: 36.7184, lng: 37.1212 }, '80': { lat: 37.0742, lng: 36.2478 }, '81': { lat: 40.8438, lng: 31.1565 },
};

/**
 * Tarifeli uçuşu olan ya da yakındaki ortak havalimanına bağlı iller (bilgi amaçlı; sefer olup olmadığı havayolu
 * sitesinden kontrol edilir). Ortak havalimanları: Çukurova (Adana-Mersin), Zafer (Kütahya-Afyon-Uşak), Ordu-Giresun,
 * Rize-Artvin.
 */
export const AIRPORT_PROVINCES = new Set([
  '01', '02', '03', '04', '06', '07', '08', '10', '12', '16', '17', '20', '21', '23', '24', '25', '27', '28', '30', '31',
  '32', '33', '34', '35', '36', '37', '38', '41', '42', '43', '44', '46', '47', '48', '49', '50', '52', '53', '55', '56',
  '57', '58', '59', '60', '61', '63', '64', '65', '67', '72', '73', '76',
]);

export const TRIP_MODES = ['araba', 'otobus', 'ucak', 'tren'] as const;
export type TripMode = (typeof TRIP_MODES)[number];
export const FUEL_TYPES = ['benzin', 'dizel', 'lpg', 'elektrik'] as const;
export type FuelType = (typeof FUEL_TYPES)[number];
/** 100 km'de ortalama tüketim (litre; elektrikte kWh). */
export const FUEL_USE: Record<FuelType, number> = { benzin: 7, dizel: 6, lpg: 9, elektrik: 18 };

/** Panelden ayda bir girilen fiyatlar (config/travelPrices). Girilmemişse ücret tahmini gösterilmez. */
export interface TravelPrices {
  /** TL/litre (elektrikte TL/kWh). */
  fuel: Partial<Record<FuelType, number>>;
  /** Şehirlerarası otobüs km başına TL aralığı. */
  busPerKm?: { min: number; max: number };
  /** Fiyatların geçerli olduğu ay ("2026-10"). */
  month: string;
}

export const TRAVEL_PRICE_LIMITS = { fuel: [1, 500], busPerKm: [0.1, 20] } as const;

export function validateTravelPrices(p: TravelPrices): ('fuel' | 'busPerKm' | 'month')[] {
  const errors: ('fuel' | 'busPerKm' | 'month')[] = [];
  const ok = (n: unknown, [lo, hi]: readonly [number, number]) => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
  if (Object.entries(p.fuel).some(([k, v]) => !(FUEL_TYPES as readonly string[]).includes(k) || (v !== undefined && !ok(v, TRAVEL_PRICE_LIMITS.fuel)))) errors.push('fuel');
  if (p.busPerKm && (!ok(p.busPerKm.min, TRAVEL_PRICE_LIMITS.busPerKm) || !ok(p.busPerKm.max, TRAVEL_PRICE_LIMITS.busPerKm) || p.busPerKm.min > p.busPerKm.max)) errors.push('busPerKm');
  if (!/^20[0-9]{2}-(0[1-9]|1[0-2])$/.test(p.month)) errors.push('month');
  return errors;
}

/** Karayolu kuş uçuşundan bu kadar uzundur (Türkiye ortalaması için kaba katsayı). */
const ROAD_FACTOR = 1.3;
const round5 = (x: number) => Math.max(5, Math.round(x / 5) * 5);
const round10 = (x: number) => Math.round(x / 10) * 10;

export interface TripEstimate {
  mode: TripMode;
  /** Yolculuk kullanılabilir mi (uçakta iki ilde de havalimanı). */
  available: boolean;
  /** Karayolu km (uçakta kuş uçuşu). */
  km: number;
  /** Tahmini süre (dakika; uçakta yalnızca uçuş). */
  minutes: number;
  /** Tahmini maliyet aralığı (TL; kişi başı otobüs, araçta toplam yakıt). Fiyat girilmemişse yok. */
  cost?: { min: number; max: number };
}

/** İki il arası karayolu km tahmini (aynı ilde 0). */
export function roadKm(from: string, to: string): number {
  const a = PROVINCE_CENTERS[from];
  const b = PROVINCE_CENTERS[to];
  if (!a || !b || from === to) return 0;
  return round5(distanceKm(a, b) * ROAD_FACTOR);
}

/**
 * Araç türüne göre tahmin. Araba: ortalama 90 km/s ve 2,5 saatte bir 15 dakika mola; yakıt seçilen türün ortalama
 * tüketimiyle ±%10. Otobüs: ortalama 70 km/s + 20 dakika; ücret km aralığıyla, kişi başı. Uçak: kuş uçuşu 650 km/s + 30
 * dakika (havalimanı süreleri hariç). Tren: yalnızca bağlantı (hat bilgisi yok).
 */
export function estimateTrip(from: string, to: string, mode: TripMode, prices: TravelPrices | null, fuel: FuelType = 'benzin'): TripEstimate {
  const km = roadKm(from, to);
  const air = from !== to && PROVINCE_CENTERS[from] && PROVINCE_CENTERS[to] ? Math.round(distanceKm(PROVINCE_CENTERS[from], PROVINCE_CENTERS[to])) : 0;
  if (mode === 'araba') {
    const drive = (km / 90) * 60;
    const price = prices?.fuel[fuel];
    const spend = price ? (km / 100) * FUEL_USE[fuel] * price : 0;
    return { mode, available: km > 0, km, minutes: Math.round(drive + Math.floor(drive / 150) * 15), ...(price ? { cost: { min: round10(spend * 0.9), max: round10(spend * 1.1) } } : {}) };
  }
  if (mode === 'otobus') {
    const bus = prices?.busPerKm;
    return { mode, available: km > 0, km, minutes: Math.round((km / 70) * 60 + 20), ...(bus ? { cost: { min: round10(km * bus.min), max: round10(km * bus.max) } } : {}) };
  }
  if (mode === 'ucak') {
    return { mode, available: air >= 150 && AIRPORT_PROVINCES.has(from) && AIRPORT_PROVINCES.has(to), km: air, minutes: Math.round((air / 650) * 60 + 30) };
  }
  return { mode, available: km > 0, km, minutes: 0 };
}

export interface RouteStop {
  place: RoadsidePlace;
  /** Yolun başından yaklaşık km (karayolu katsayısıyla). */
  atKm: number;
  /** Düz güzergâh çizgisine uzaklık (km). */
  offKm: number;
}

/**
 * Güzergâh çevresindeki mola yerleri (yaklaşık): iki il merkezi arasındaki düz çizgiye en çok maxOffKm uzaklıktakiler,
 * yolun her "bucketKm"lik dilimi için bir tane (dinlenme tesisi ve olanağı çok olan önce). Gerçek yol çizgiden
 * sapabilir; ekranda "yaklaşık" yazılır.
 */
export function stopsAlongRoute(
  places: readonly RoadsidePlace[],
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  opts: { maxOffKm?: number; bucketKm?: number; max?: number } = {},
): RouteStop[] {
  const maxOff = opts.maxOffKm ?? 8;
  const bucket = opts.bucketKm ?? 50;
  // Yerel düzlem (km): kısa-orta mesafede yeterli.
  const kx = 111 * Math.cos((((from.lat + to.lat) / 2) * Math.PI) / 180);
  const ky = 111;
  const bx = (to.lng - from.lng) * kx;
  const by = (to.lat - from.lat) * ky;
  const len2 = bx * bx + by * by;
  if (!len2) return [];
  const total = Math.sqrt(len2);
  const best = new Map<number, RouteStop & { score: number }>();
  for (const p of places) {
    const px = (p.geo.lng - from.lng) * kx;
    const py = (p.geo.lat - from.lat) * ky;
    const t = (px * bx + py * by) / len2;
    if (t <= 0.02 || t >= 0.98) continue;
    const off = Math.hypot(px - t * bx, py - t * by);
    if (off > maxOff) continue;
    const atKm = Math.round(t * total * ROAD_FACTOR);
    const slot = Math.floor(atKm / bucket);
    const score = (p.kind === 'yol-dinlenme-tesisi' ? 10 : 0) + (p.source === 'isletme' ? 5 : 0) + p.roadside.length - off / 4;
    const cur = best.get(slot);
    if (!cur || score > cur.score) best.set(slot, { place: p, atKm, offKm: Math.round(off * 10) / 10, score });
  }
  return [...best.values()]
    .sort((a, b) => a.atKm - b.atKm)
    .slice(0, opts.max ?? 8)
    .map(({ score: _s, ...s }) => s);
}

/** Düz güzergâh boyunca örnek noktalar (yol üstü paketlerini okumak için), her stepKm'de bir. */
export function pointsAlongRoute(from: { lat: number; lng: number }, to: { lat: number; lng: number }, stepKm = 60): { lat: number; lng: number }[] {
  const n = Math.max(1, Math.ceil(distanceKm(from, to) / stepKm));
  return Array.from({ length: n + 1 }, (_, i) => ({ lat: from.lat + ((to.lat - from.lat) * i) / n, lng: from.lng + ((to.lng - from.lng) * i) / n }));
}

/** Telefonda saklanan plan. */
export interface TripPlan {
  id: string;
  from: string;
  to: string;
  /** "2026-10-30" */
  date: string;
  people: number;
  mode: TripMode;
  fuel: FuelType;
  /** Hazırlık listesinde işaretlenenler. */
  checked: string[];
  createdAt: string;
}

export const PREP_ITEMS: Record<TripMode, string[]> = {
  araba: ['ehliyet', 'lastik', 'yakit', 'su', 'sarj', 'ilac', 'hgs', 'yedek'],
  otobus: ['kimlik', 'bilet', 'sarj', 'su', 'ilac', 'atistirmalik'],
  ucak: ['kimlik', 'bilet', 'bagaj', 'sarj', 'ilac', 'erken'],
  tren: ['kimlik', 'bilet', 'sarj', 'su', 'ilac', 'atistirmalik'],
};
