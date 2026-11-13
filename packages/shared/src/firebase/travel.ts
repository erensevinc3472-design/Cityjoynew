import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from './metered';

import { SEED_CITIES, SEED_LOCAL, SEED_PLACES, SEED_REGIONS, SEED_ROUTES } from '../travel/seed';
import { travelPlaceId, type TravelImport } from '../travel/sheet';
import { municipalVideos, type MunicipalVideo } from '../travel/travel';
import type {
  TravelCityContent,
  TravelLocalInput,
  TravelLocalItem,
  TravelMunicipal,
  TravelMunicipalText,
  TravelPlace,
  TravelPlaceInput,
  TravelRegionContent,
  TravelReviewStatus,
  TravelRoute,
  TravelRouteInput,
  PlaceHours,
  TourScene,
} from '../travel/travel';
import { cleanPhoto, photoFrom, type Photo } from '../media/photo';
import { addAudit, iso } from './grants';

const REGIONS = 'travelRegions';
const CITIES = 'travelCities';
const PLACES = 'travelPlaces';
const ROUTES = 'travelRoutes';
const LOCAL = 'travelLocal';
const MUNICIPAL = 'travelMunicipal';

/** Boş isteğe bağlı alanlar belgeye yazılmaz (güncellemede silinir). Kapak yalnızca dört alanıyla yazılır. */
/** Yazılacak video listesi: boş satırlar atılır, yazılar kırpılır; liste boşsa alan silinir. */
const cleanVideos = (m: { videos?: MunicipalVideo[]; videoUrl?: string }) =>
  (m.videos?.length ? m.videos : m.videoUrl ? [{ url: m.videoUrl }] : []).map((x) => ({ url: x.url.trim(), ...(x.title?.trim() ? { title: x.title.trim() } : {}) })).filter((x) => x.url);

const clean = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(
    Object.entries(o)
      .map(([k, v]) => [k, (k === 'cover' || k === 'mayorPhoto') && v ? cleanPhoto(v as Photo) : typeof v === 'string' ? v.trim() : v])
      .filter(([, v]) => v !== undefined && v !== ''),
  ) as T;

/** Ham belgeden kapak alanı ayrılır (yerine `coverOf` doğrulanmış olanı koyar). */
const withoutCover = (d: DocumentData) => {
  const { cover: _cover, ...rest } = d;
  return rest;
};

/** Okunan kapak yalnızca kendi depomuzdaki geçerli bir görselse alınır. */
const coverOf = (d: DocumentData) => {
  const cover = photoFrom(d.cover);
  return cover ? { cover } : {};
};

const region = (id: string, d: DocumentData): TravelRegionContent => ({
  id,
  tagline: d.tagline ?? '',
  description: d.description ?? '',
  ...(d.videoUrl ? { videoUrl: d.videoUrl } : {}),
  ...coverOf(d),
  status: d.status,
  updatedAt: iso(d.updatedAt) ?? '',
});

const city = (id: string, d: DocumentData): TravelCityContent => ({
  id,
  regionId: d.regionId,
  tagline: d.tagline ?? '',
  description: d.description ?? '',
  categories: d.categories ?? [],
  highlights: d.highlights ?? [],
  facts: d.facts ?? [],
  ...(d.videoUrl ? { videoUrl: d.videoUrl } : {}),
  ...coverOf(d),
  status: d.status,
  updatedAt: iso(d.updatedAt) ?? '',
});

/** Okunan sahneler: resmi geçersiz olan sahne atlanır, nokta yerleri 0-1 arasına sıkıştırılır. */
const tourOf = (d: DocumentData): { tour?: TourScene[] } => {
  if (!Array.isArray(d.tour)) return {};
  const unit = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5);
  const tour = (d.tour as DocumentData[]).flatMap((s): TourScene[] => {
    const image = photoFrom(s?.image);
    if (!image) return [];
    const points = (Array.isArray(s.points) ? s.points : []).map((p: DocumentData) => ({
      x: unit(p?.x),
      y: unit(p?.y),
      title: String(p?.title ?? ''),
      look: String(p?.look ?? ''),
      story: String(p?.story ?? ''),
    }));
    return [{ label: String(s.label ?? ''), image, points }];
  });
  return tour.length ? { tour } : {};
};

/** Açılış saatleri: her zaman açıkta saat alanı yazılmaz (Firestore boş değer kabul etmez). */
const cleanHours = (h: PlaceHours | undefined) =>
  h ? { allDay: h.allDay, ...(h.allDay ? {} : { open: h.open, close: h.close }), closedDays: [...h.closedDays].sort((a, b) => a - b), prayer: h.prayer } : undefined;

/** Yazılacak sahneler: resim dört alanıyla, yazılar kırpılmış. Boşsa alan yazılmaz. */
const cleanTour = (tour: TourScene[] | undefined) =>
  tour?.length
    ? tour.map((s) => ({
        label: s.label.trim(),
        image: cleanPhoto(s.image),
        points: s.points.map((p) => ({ x: p.x, y: p.y, title: p.title.trim(), look: p.look.trim(), story: p.story.trim() })),
      }))
    : undefined;

const placeOf = (id: string, d: DocumentData): TravelPlace => ({
  ...(withoutCover(d) as TravelPlace),
  id,
  ...coverOf(d),
  ...tourOf(d),
  howToGet: d.howToGet ?? [],
  nearby: d.nearby ?? [],
  tips: d.tips ?? [],
  mustSee: d.mustSee === true,
  order: d.order ?? 0,
  updatedAt: iso(d.updatedAt) ?? '',
});

const byOrder = (a: TravelPlace, b: TravelPlace) => a.order - b.order || a.name.localeCompare(b.name, 'tr');

const routeOf = (id: string, d: DocumentData): TravelRoute => ({
  ...(withoutCover(d) as TravelRoute),
  id,
  ...coverOf(d),
  stops: d.stops ?? [],
  tips: d.tips ?? [],
  order: d.order ?? 0,
  updatedAt: iso(d.updatedAt) ?? '',
});
const localOf = (id: string, d: DocumentData): TravelLocalItem => ({
  ...(withoutCover(d) as TravelLocalItem),
  id,
  ...coverOf(d),
  subtitle: d.subtitle ?? '',
  badges: d.badges ?? [],
  facts: d.facts ?? [],
  order: d.order ?? 0,
  updatedAt: iso(d.updatedAt) ?? '',
});
const municipalOf = (id: string, d: DocumentData): TravelMunicipal => {
  const { mayorPhoto: raw, ...rest } = withoutCover(d);
  const mayorPhoto = photoFrom(raw);
  return {
  ...(rest as TravelMunicipal),
  id,
  ...coverOf(d),
  ...(mayorPhoto ? { mayorPhoto } : {}),
  videos: municipalVideos(d),
  showMayor: d.showMayor !== false,
  updatedAt: iso(d.updatedAt) ?? '',
  };
};
const ordered = <T extends { order: number; title: string }>(a: T, b: T) => a.order - b.order || a.title.localeCompare(b.title, 'tr');

/** Durakların boş isteğe bağlı alanları yazılmaz. */
const cleanRoute = (r: TravelRouteInput) => ({
  ...clean(r as unknown as Record<string, unknown>),
  stops: r.stops.map((x) => clean({ ...x, next: x.next ? { mode: x.next.mode, text: x.next.text.trim() } : undefined })),
});

/** Uygulama: yalnızca yayındaki seyahat içeriği (kurallar taslakları okutmaz). */
export function createFirestoreTravelRepository(db: Firestore) {
  const published = (col: string, ...c: ReturnType<typeof where>[]) => getDocs(query(collection(db, col), where('status', '==', 'yayinda'), ...c, limit(200)));
  return {
    async listRegions(): Promise<TravelRegionContent[]> {
      return (await published(REGIONS)).docs.map((d) => region(d.id, d.data()));
    },
    async listCities(regionId: string): Promise<TravelCityContent[]> {
      return (await published(CITIES, where('regionId', '==', regionId))).docs.map((d) => city(d.id, d.data()));
    },
    async getCity(code: string): Promise<TravelCityContent | null> {
      const s = await getDoc(doc(db, CITIES, code));
      return s.exists() ? city(s.id, s.data()) : null;
    },
    async listPlaces(cityId: string): Promise<TravelPlace[]> {
      return (await published(PLACES, where('cityId', '==', cityId))).docs.map((d) => placeOf(d.id, d.data())).sort(byOrder);
    },
    async getPlace(id: string): Promise<TravelPlace | null> {
      const s = await getDoc(doc(db, PLACES, id));
      return s.exists() ? placeOf(s.id, s.data()) : null;
    },
    async listRoutes(cityId: string): Promise<TravelRoute[]> {
      return (await published(ROUTES, where('cityId', '==', cityId))).docs.map((d) => routeOf(d.id, d.data())).sort(ordered);
    },
    async getRoute(id: string): Promise<TravelRoute | null> {
      const s = await getDoc(doc(db, ROUTES, id));
      return s.exists() ? routeOf(s.id, s.data()) : null;
    },
    async listLocal(cityId: string): Promise<TravelLocalItem[]> {
      return (await published(LOCAL, where('cityId', '==', cityId))).docs.map((d) => localOf(d.id, d.data())).sort(ordered);
    },
    async listMunicipal(cityId: string): Promise<TravelMunicipal[]> {
      return (await published(MUNICIPAL, where('cityId', '==', cityId))).docs.map((d) => municipalOf(d.id, d.data()));
    },
  };
}

export type TravelAdminKind = 'bolge' | 'sehir' | 'yer' | 'rota' | 'yoresel' | 'belediye';
type Kind = TravelAdminKind;
const colOf: Record<Kind, string> = { bolge: REGIONS, sehir: CITIES, yer: PLACES, rota: ROUTES, yoresel: LOCAL, belediye: MUNICIPAL };

/**
 * Panel > Seyahat (admin, ülke geneli): bölge, şehir ve gezilecek yer içeriği; taslak / yayında; başlangıç içeriğini
 * taslak olarak yükleme. Her işlem işlem kaydına yazılır.
 */
export function createTravelAdmin(db: Firestore, actorUid: string) {
  const audit = (batch: ReturnType<typeof writeBatch>, targetId: string, action: 'ekle' | 'duzenle' | 'sil' | 'yayinla', summary: string) =>
    addAudit(db, batch, { actorUid, module: 'seyahat', action, targetId, summary });

  return {
    async listAll(): Promise<{
      regions: TravelRegionContent[];
      cities: TravelCityContent[];
      places: TravelPlace[];
      routes: TravelRoute[];
      local: TravelLocalItem[];
      municipal: TravelMunicipal[];
    }> {
      const all = (col: string, n = 1000) => getDocs(query(collection(db, col), limit(n)));
      const [r, c, p, ro, lo, mu] = await Promise.all([all(REGIONS), all(CITIES), all(PLACES, 5000), all(ROUTES), all(LOCAL), all(MUNICIPAL)]);
      return {
        regions: r.docs.map((d) => region(d.id, d.data())),
        cities: c.docs.map((d) => city(d.id, d.data())),
        places: p.docs.map((d) => placeOf(d.id, d.data())).sort(byOrder),
        routes: ro.docs.map((d) => routeOf(d.id, d.data())).sort(ordered),
        local: lo.docs.map((d) => localOf(d.id, d.data())).sort(ordered),
        municipal: mu.docs.map((d) => municipalOf(d.id, d.data())),
      };
    },

    async saveRegion(r: Omit<TravelRegionContent, 'updatedAt'>, isNew: boolean) {
      const batch = writeBatch(db);
      const { id, ...rest } = r;
      batch.set(doc(db, REGIONS, id), { ...clean(rest), updatedAt: serverTimestamp() });
      audit(batch, id, isNew ? 'ekle' : 'duzenle', `Seyahat bölgesi: ${id}`);
      await batch.commit();
    },

    async saveCity(c: Omit<TravelCityContent, 'updatedAt'>, isNew: boolean) {
      const batch = writeBatch(db);
      const { id, ...rest } = c;
      batch.set(doc(db, CITIES, id), { ...clean(rest), updatedAt: serverTimestamp() });
      audit(batch, id, isNew ? 'ekle' : 'duzenle', `Seyahat şehri: ${id}`);
      await batch.commit();
    },

    /** Döner: yerin kimliği (yeni yerde üretilir). */
    async savePlace(id: string | null, p: TravelPlaceInput): Promise<string> {
      const ref = id ? doc(db, PLACES, id) : doc(collection(db, PLACES));
      const batch = writeBatch(db);
      batch.set(ref, { ...clean({ ...p, tour: cleanTour(p.tour), hours: cleanHours(p.hours) } as unknown as Record<string, unknown>), updatedAt: serverTimestamp() });
      audit(batch, ref.id, id ? 'duzenle' : 'ekle', `Gezilecek yer: ${p.name}`);
      await batch.commit();
      return ref.id;
    },

    async saveRoute(id: string | null, r: TravelRouteInput): Promise<string> {
      const ref = id ? doc(db, ROUTES, id) : doc(collection(db, ROUTES));
      const batch = writeBatch(db);
      batch.set(ref, { ...cleanRoute(r), updatedAt: serverTimestamp() });
      audit(batch, ref.id, id ? 'duzenle' : 'ekle', `Hazır rota: ${r.title}`);
      await batch.commit();
      return ref.id;
    },

    async saveLocal(id: string | null, x: TravelLocalInput): Promise<string> {
      const ref = id ? doc(db, LOCAL, id) : doc(collection(db, LOCAL));
      const batch = writeBatch(db);
      batch.set(ref, { ...clean(x as unknown as Record<string, unknown>), updatedAt: serverTimestamp() });
      audit(batch, ref.id, id ? 'duzenle' : 'ekle', `Yöresel: ${x.title}`);
      await batch.commit();
      return ref.id;
    },

    /** Belediye tanıtımı: admin her alanı (nüfus, bölge, başkan adının gösterilmesi dahil) değiştirir. */
    async saveMunicipal(m: Omit<TravelMunicipal, 'updatedAt'>, label: string) {
      const batch = writeBatch(db);
      const { id, ...rest } = m;
      // Slogan ve tanıtım boş olabilir (yalnızca başkan bilgisi); boş metin de yazılır.
      batch.set(doc(db, MUNICIPAL, id), {
        ...clean({ ...rest, videoUrl: undefined, videos: undefined } as unknown as Record<string, unknown>),
        ...(cleanVideos(rest).length ? { videos: cleanVideos(rest) } : {}),
        slogan: rest.slogan.trim(),
        description: rest.description.trim(),
        updatedAt: serverTimestamp(),
      });
      audit(batch, id, 'duzenle', `Belediye tanıtımı: ${label}`);
      await batch.commit();
    },

    /** Sürükleyerek verilen yeni sıra (gezilecek yerler, rotalar, yöresel; 1'den başlar). Döner: değişen sayısı. */
    async reorder(kind: 'yer' | 'rota' | 'yoresel', list: { id: string; order: number }[], label: string): Promise<number> {
      const changed = list.map((x, i) => ({ id: x.id, order: i + 1, before: x.order })).filter((x) => x.order !== x.before);
      if (!changed.length) return 0;
      const batch = writeBatch(db);
      for (const x of changed) batch.update(doc(db, colOf[kind], x.id), { order: x.order, updatedAt: serverTimestamp() });
      audit(batch, `siralama-${kind}`, 'duzenle', `Sıralama değiştirildi: ${label} (${changed.length} kayıt)`);
      await batch.commit();
      return changed.length;
    },

    async remove(kind: 'rota' | 'yoresel', id: string, label: string) {
      const batch = writeBatch(db);
      batch.delete(doc(db, colOf[kind], id));
      audit(batch, id, 'sil', `${kind === 'rota' ? 'Hazır rota' : 'Yöresel'} silindi: ${label}`);
      await batch.commit();
    },

    async setStatus(kind: Kind, id: string, status: TravelReviewStatus, label: string) {
      const batch = writeBatch(db);
      batch.update(doc(db, colOf[kind], id), { status, updatedAt: serverTimestamp() });
      audit(batch, id, status === 'yayinda' ? 'yayinla' : 'duzenle', `${status === 'yayinda' ? 'Yayına alındı' : 'Taslağa çekildi'}: ${label}`);
      await batch.commit();
    },

    async deletePlace(p: TravelPlace) {
      const batch = writeBatch(db);
      batch.delete(doc(db, PLACES, p.id));
      audit(batch, p.id, 'sil', `Gezilecek yer silindi: ${p.name}`);
      await batch.commit();
    },

    /**
     * Excel'den toplu yükleme (bölge, şehir, gezilecek yer). Yeni kayıt taslak girer; var olanın alanları güncellenir,
     * yayın durumu ve kapak fotoğrafı korunur. Gezilecek yer, aynı ildeki aynı adlı yerle eşleşir (başlangıç
     * içeriğindeki yerler dahil). Hiçbir şey silinmez. Döner: eklenen ve güncellenen sayısı.
     */
    async importContent(input: Pick<TravelImport, 'regions' | 'cities' | 'places'>): Promise<{ added: number; updated: number }> {
      let added = 0;
      let updated = 0;
      const writes: { col: string; id: string; data: Record<string, unknown>; isNew: boolean }[] = [];
      const exists = async (col: string, id: string) => (await getDoc(doc(db, col, id))).exists();
      for (const r of input.regions) {
        const { id, ...rest } = r;
        writes.push({ col: REGIONS, id, data: rest, isNew: !(await exists(REGIONS, id)) });
      }
      for (const c of input.cities) {
        const { id, ...rest } = c;
        writes.push({ col: CITIES, id, data: rest, isNew: !(await exists(CITIES, id)) });
      }
      const byCity = new Map<string, Map<string, string>>();
      for (const p of input.places) {
        let names = byCity.get(p.data.cityId);
        if (!names) {
          const snap = await getDocs(query(collection(db, PLACES), where('cityId', '==', p.data.cityId), limit(1000)));
          names = new Map(snap.docs.map((d) => [travelPlaceId(p.data.cityId, String(d.data().name ?? '')), d.id]));
          byCity.set(p.data.cityId, names);
        }
        const existing = names.get(p.id);
        const data = { ...p.data, hours: cleanHours(p.data.hours) };
        writes.push({ col: PLACES, id: existing ?? p.id, data: data as unknown as Record<string, unknown>, isNew: !existing && !(await exists(PLACES, p.id)) });
      }
      for (let i = 0; i < writes.length; i += 400) {
        const part = writes.slice(i, i + 400);
        const batch = writeBatch(db);
        for (const w of part) {
          const data = { ...clean(w.data), updatedAt: serverTimestamp(), ...(w.isNew ? { status: 'taslak' } : {}) };
          batch.set(doc(db, w.col, w.id), data, { merge: true });
          if (w.isNew) added++;
          else updated++;
        }
        const n = part.filter((w) => w.isNew).length;
        audit(batch, `seyahat-excel-${i / 400 + 1}`, 'ekle', `Seyahat Excel yüklemesi: ${n} yeni, ${part.length - n} güncellenen kayıt`);
        await batch.commit();
      }
      return { added, updated };
    },

    /** Başlangıç içeriği (Marmara, Bursa): yalnızca olmayanlar taslak olarak eklenir. Döner: eklenen sayısı. */
    async importSeed(): Promise<number> {
      const batch = writeBatch(db);
      let n = 0;
      const add = async (col: string, id: string, data: Record<string, unknown>) => {
        if ((await getDoc(doc(db, col, id))).exists()) return;
        batch.set(doc(db, col, id), { ...clean(data), status: 'taslak', updatedAt: serverTimestamp() });
        n++;
      };
      for (const r of SEED_REGIONS) await add(REGIONS, r.id, { tagline: r.tagline, description: r.description });
      for (const c of SEED_CITIES) {
        const { id, ...rest } = c;
        await add(CITIES, id, rest);
      }
      for (const p of SEED_PLACES) await add(PLACES, p.id, p.data as unknown as Record<string, unknown>);
      for (const r of SEED_ROUTES) await add(ROUTES, r.id, cleanRoute({ ...r.data, status: 'taslak' }));
      for (const x of SEED_LOCAL) await add(LOCAL, x.id, x.data as unknown as Record<string, unknown>);
      if (n) audit(batch, 'seyahat-baslangic', 'ekle', `Seyahat başlangıç içeriği taslak olarak yüklendi (${n} kayıt)`);
      await batch.commit();
      return n;
    },
  };
}


/**
 * Belediye paneli > Başkanlarla Keşif (PROJE.md 5.2, 6.2 madde 25): belediye personeli kendi tanıtımını (slogan, yazı,
 * video, başkan adı) ve rotalarını hazırlar, onaya gönderir; CityJoy (admin) kontrol edip yayına alır. Nüfus, bölge ve
 * başkan adının gösterilmesi admin'dedir. Her işlem işlem kaydına yazılır.
 */
export function createMunicipalTravel(db: Firestore, actorUid: string, org: { id: string; name: string; cityId: string; districtId?: string }) {
  const audit = (batch: ReturnType<typeof writeBatch>, targetId: string, action: 'ekle' | 'duzenle' | 'sil', summary: string) =>
    addAudit(db, batch, { actorUid, module: 'seyahat', action, targetId, summary, orgId: org.id });

  return {
    async get(): Promise<TravelMunicipal | null> {
      const s = await getDoc(doc(db, MUNICIPAL, org.id));
      return s.exists() ? municipalOf(s.id, s.data()) : null;
    },

    /** submit: onaya gönder (yoksa taslak). Yayındaki tanıtım değişince yeniden onaya düşer. */
    async saveText(text: TravelMunicipalText, submit: boolean) {
      const batch = writeBatch(db);
      batch.set(
        doc(db, MUNICIPAL, org.id),
        {
          cityId: org.cityId,
          ...(org.districtId ? { districtId: org.districtId } : {}),
          slogan: text.slogan.trim(),
          description: text.description.trim(),
          // Eski tek video alanı listeye taşınır.
          videoUrl: deleteField(),
          videos: cleanVideos(text).length ? cleanVideos(text) : deleteField(),
          mayorName: text.mayorName?.trim() ? text.mayorName.trim() : deleteField(),
          cover: text.cover ? cleanPhoto(text.cover) : deleteField(),
          mayorPhoto: text.mayorPhoto ? cleanPhoto(text.mayorPhoto) : deleteField(),
          mayorActing: text.mayorActing ? true : deleteField(),
          status: submit ? 'onay-bekliyor' : 'taslak',
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      audit(batch, org.id, 'duzenle', `${org.name}: Başkanlarla Keşif tanıtımı ${submit ? 'onaya gönderildi' : 'kaydedildi'}`);
      await batch.commit();
    },

    async listRoutes(): Promise<TravelRoute[]> {
      const s = await getDocs(query(collection(db, ROUTES), where('municipalityId', '==', org.id), limit(50)));
      return s.docs.map((d) => routeOf(d.id, d.data())).sort(ordered);
    },

    async saveRoute(id: string | null, r: Omit<TravelRouteInput, 'municipalityId' | 'cityId' | 'status'>, submit: boolean): Promise<string> {
      const ref = id ? doc(db, ROUTES, id) : doc(collection(db, ROUTES));
      const batch = writeBatch(db);
      batch.set(ref, {
        ...cleanRoute({ ...r, cityId: org.cityId, municipalityId: org.id, status: submit ? 'onay-bekliyor' : 'taslak' }),
        updatedAt: serverTimestamp(),
      });
      audit(batch, ref.id, id ? 'duzenle' : 'ekle', `${org.name}: keşif rotası ${submit ? 'onaya gönderildi' : 'kaydedildi'}: ${r.title}`);
      await batch.commit();
      return ref.id;
    },

    async deleteRoute(r: TravelRoute) {
      const batch = writeBatch(db);
      batch.delete(doc(db, ROUTES, r.id));
      audit(batch, r.id, 'sil', `${org.name}: keşif rotası silindi: ${r.title}`);
      await batch.commit();
    },
  };
}
