import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import { byIssueDesc, type CityShowcase, type CityShowcaseInput, type ShowcaseStatus } from '../city-guide/showcase';
import { addAudit, iso } from './grants';

const COLLECTION = 'cityShowcases';

const fromDoc = (id: string, d: DocumentData): CityShowcase => ({
  ...(d as CityShowcase),
  id,
  intro: d.intro ?? '',
  stories: d.stories ?? [],
  updatedAt: iso(d.updatedAt) ?? '',
});

/** Boş isteğe bağlı alanlar yazılmaz. */
const clean = (s: CityShowcaseInput) => ({
  ...s,
  title: s.title.trim(),
  intro: s.intro.trim(),
  stories: s.stories.map((x) => ({
    title: x.title.trim(),
    theme: x.theme,
    ...(x.subtitle?.trim() ? { subtitle: x.subtitle.trim() } : {}),
    ...(x.body?.trim() ? { body: x.body.trim() } : {}),
    items: x.items.map((i) => ({ kind: i.kind, id: i.id, name: i.name.trim(), ...(i.note?.trim() ? { note: i.note.trim() } : {}) })),
  })),
});

/** Uygulama: ilin yayındaki sayıları, en yenisi önce (en çok 20). */
export function createFirestoreShowcaseRepository(db: Firestore) {
  return {
    async listPublished(provinceCode: string): Promise<CityShowcase[]> {
      const s = await getDocs(query(collection(db, COLLECTION), where('provinceCode', '==', provinceCode), where('status', '==', 'yayinda'), limit(20)));
      return s.docs.map((d) => fromDoc(d.id, d.data())).sort(byIssueDesc);
    },
  };
}

/** Panel > Şehir Vitrini (admin ve o ilin şehir rehberi yetkisi). Her işlem işlem kaydına yazılır. */
export function createShowcaseAdmin(db: Firestore, actorUid: string) {
  const audit = (batch: ReturnType<typeof writeBatch>, provinceCode: string, targetId: string, action: 'ekle' | 'duzenle' | 'sil', summary: string) =>
    addAudit(db, batch, { actorUid, module: 'sehir-rehberi', action, targetId, summary, scope: { level: 'il', provinceCode } });

  return {
    async list(provinceCode: string): Promise<CityShowcase[]> {
      const s = await getDocs(query(collection(db, COLLECTION), where('provinceCode', '==', provinceCode), limit(100)));
      return s.docs.map((d) => fromDoc(d.id, d.data())).sort(byIssueDesc);
    },

    /** Döner: sayının kimliği. */
    async save(id: string | null, input: CityShowcaseInput): Promise<string> {
      const ref = id ? doc(db, COLLECTION, id) : doc(collection(db, COLLECTION));
      const batch = writeBatch(db);
      batch.set(ref, { ...clean(input), updatedAt: serverTimestamp() });
      audit(batch, input.provinceCode, ref.id, id ? 'duzenle' : 'ekle', `Şehir Vitrini sayı ${input.issue}: ${input.title.trim()}`);
      await batch.commit();
      return ref.id;
    },

    async setStatus(s: CityShowcase, status: ShowcaseStatus) {
      const batch = writeBatch(db);
      batch.update(doc(db, COLLECTION, s.id), { status, updatedAt: serverTimestamp() });
      audit(batch, s.provinceCode, s.id, 'duzenle', `Şehir Vitrini sayı ${s.issue} ${status === 'yayinda' ? 'yayına alındı' : 'taslağa çekildi'}`);
      await batch.commit();
    },

    async remove(s: CityShowcase) {
      const batch = writeBatch(db);
      batch.delete(doc(db, COLLECTION, s.id));
      audit(batch, s.provinceCode, s.id, 'sil', `Şehir Vitrini sayı ${s.issue} silindi`);
      await batch.commit();
    },
  };
}
