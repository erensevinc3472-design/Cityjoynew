import {
  collection,
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
} from 'firebase/firestore';

import { SEED_CITIES, SEED_PLACES, SEED_REGIONS } from '../travel/seed';
import type { TravelCityContent, TravelPlace, TravelPlaceInput, TravelRegionContent, TravelStatus } from '../travel/travel';
import { addAudit, iso } from './grants';

const REGIONS = 'travelRegions';
const CITIES = 'travelCities';
const PLACES = 'travelPlaces';

/** Boş isteğe bağlı alanlar belgeye yazılmaz (güncellemede silinir). */
const clean = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]).filter(([, v]) => v !== undefined && v !== '')) as T;

const region = (id: string, d: DocumentData): TravelRegionContent => ({
  id,
  tagline: d.tagline ?? '',
  description: d.description ?? '',
  ...(d.videoUrl ? { videoUrl: d.videoUrl } : {}),
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
  status: d.status,
  updatedAt: iso(d.updatedAt) ?? '',
});

const placeOf = (id: string, d: DocumentData): TravelPlace => ({
  ...(d as TravelPlace),
  id,
  howToGet: d.howToGet ?? [],
  nearby: d.nearby ?? [],
  tips: d.tips ?? [],
  mustSee: d.mustSee === true,
  order: d.order ?? 0,
  updatedAt: iso(d.updatedAt) ?? '',
});

const byOrder = (a: TravelPlace, b: TravelPlace) => a.order - b.order || a.name.localeCompare(b.name, 'tr');

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
  };
}

type Kind = 'bolge' | 'sehir' | 'yer';
const colOf: Record<Kind, string> = { bolge: REGIONS, sehir: CITIES, yer: PLACES };

/**
 * Panel > Seyahat (admin, ülke geneli): bölge, şehir ve gezilecek yer içeriği; taslak / yayında; başlangıç içeriğini
 * taslak olarak yükleme. Her işlem işlem kaydına yazılır.
 */
export function createTravelAdmin(db: Firestore, actorUid: string) {
  const audit = (batch: ReturnType<typeof writeBatch>, targetId: string, action: 'ekle' | 'duzenle' | 'sil' | 'yayinla', summary: string) =>
    addAudit(db, batch, { actorUid, module: 'seyahat', action, targetId, summary });

  return {
    async listAll(): Promise<{ regions: TravelRegionContent[]; cities: TravelCityContent[]; places: TravelPlace[] }> {
      const [r, c, p] = await Promise.all([getDocs(collection(db, REGIONS)), getDocs(collection(db, CITIES)), getDocs(query(collection(db, PLACES), limit(1000)))]);
      return {
        regions: r.docs.map((d) => region(d.id, d.data())),
        cities: c.docs.map((d) => city(d.id, d.data())),
        places: p.docs.map((d) => placeOf(d.id, d.data())).sort(byOrder),
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
      batch.set(ref, { ...clean(p as unknown as Record<string, unknown>), updatedAt: serverTimestamp() });
      audit(batch, ref.id, id ? 'duzenle' : 'ekle', `Gezilecek yer: ${p.name}`);
      await batch.commit();
      return ref.id;
    },

    async setStatus(kind: Kind, id: string, status: TravelStatus, label: string) {
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
      if (n) audit(batch, 'seyahat-baslangic', 'ekle', `Seyahat başlangıç içeriği taslak olarak yüklendi (${n} kayıt)`);
      await batch.commit();
      return n;
    },
  };
}

