import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

import {
  DEFAULT_SERVICE_CATEGORIES,
  type ServiceCategory,
  type ServiceCategoryRepository,
  type ServiceSuggestion,
} from '../categories/service-categories';
import type { Action, Module } from '../permissions/types';

const COLLECTION = 'serviceCategories';
const SUGGESTIONS = 'serviceSuggestions';
/** Liste her değiştiğinde güncellenen sürüm belgesi; uygulama yalnızca bunu okuyup değişiklik var mı bakar. */
const versionDoc = (db: Firestore) => doc(db, 'catalogVersions', 'serviceCategories');

async function listAll(db: Firestore): Promise<ServiceCategory[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => {
    const { updatedAt: _u, updatedBy: _b, ...data } = d.data();
    return { id: d.id, ...(data as Omit<ServiceCategory, 'id'>) };
  });
}

/** Uygulama: kategorileri herkes okur (girişsiz de). */
export function createFirestoreServiceCategoryRepository(db: Firestore): ServiceCategoryRepository {
  return {
    async version() {
      const snap = await getDoc(versionDoc(db));
      const at = snap.get('updatedAt') as Timestamp | undefined;
      return at ? String(at.toMillis()) : null;
    },
    listAll: () => listAll(db),
  };
}

/** "Eksik hizmet mi var? Bildir": giriş yapmış kullanıcı öneri gönderir. */
export async function submitServiceSuggestion(db: Firestore, uid: string, text: string, provinceCode?: string) {
  await addDoc(collection(db, SUGGESTIONS), {
    uid,
    text: text.trim(),
    ...(provinceCode ? { provinceCode } : {}),
    status: 'yeni',
    createdAt: serverTimestamp(),
  });
}

/**
 * Hizmet kategorisi yönetimi (admin, ülke geneli). Her değişiklik aynı toplu yazımda işlem kaydına ve
 * sürüm belgesine de yazılır; biri yazılamazsa hiçbiri yazılmaz.
 */
export function createServiceCategoryAdmin(db: Firestore, actorUid: string) {
  const module: Module = 'hizmet-kategorileri';
  const audit = (batch: ReturnType<typeof writeBatch>, action: Action, targetId: string, summary: string) => {
    batch.set(doc(collection(db, 'auditLog')), { actorUid, module, action, targetId, at: serverTimestamp(), summary });
  };
  const bumpVersion = (batch: ReturnType<typeof writeBatch>) =>
    batch.set(versionDoc(db), { updatedAt: serverTimestamp(), updatedBy: actorUid });
  const toData = (c: ServiceCategory) => ({
    parentId: c.parentId,
    names: Object.fromEntries(Object.entries(c.names).filter(([, v]) => !!v?.trim()).map(([k, v]) => [k, v!.trim()])),
    icon: c.icon,
    order: c.order,
    active: c.active,
    ...(c.urgent ? { urgent: true } : {}),
    updatedBy: actorUid,
    updatedAt: serverTimestamp(),
  });

  return {
    listAll: () => listAll(db),

    async save(c: ServiceCategory, isNew: boolean) {
      const batch = writeBatch(db);
      batch.set(doc(db, COLLECTION, c.id), toData(c));
      bumpVersion(batch);
      audit(batch, isNew ? 'ekle' : 'duzenle', c.id, `${isNew ? 'Eklendi' : 'Düzenlendi'}: ${c.names.tr.trim()}`);
      await batch.commit();
    },

    async setActive(c: ServiceCategory, active: boolean) {
      const batch = writeBatch(db);
      batch.set(doc(db, COLLECTION, c.id), toData({ ...c, active }));
      bumpVersion(batch);
      audit(batch, 'duzenle', c.id, `${active ? 'Etkinleştirildi' : 'Pasifleştirildi'}: ${c.names.tr}`);
      await batch.commit();
    },

    /** Başlangıç listesini veritabanına yükler (yalnızca eksik olanları). */
    async seedDefaults(existingIds: Set<string>) {
      const missing = DEFAULT_SERVICE_CATEGORIES.filter((c) => !existingIds.has(c.id));
      if (!missing.length) return 0;
      const batch = writeBatch(db);
      for (const c of missing) batch.set(doc(db, COLLECTION, c.id), toData(c));
      bumpVersion(batch);
      audit(batch, 'ekle', 'varsayilan-liste', `Başlangıç hizmet kategorileri yüklendi (${missing.length} kategori)`);
      await batch.commit();
      return missing.length;
    },

    /** Son öneriler, yeniden eskiye. */
    async listSuggestions(max = 100): Promise<ServiceSuggestion[]> {
      const snap = await getDocs(query(collection(db, SUGGESTIONS), orderBy('createdAt', 'desc'), limit(max)));
      return snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          uid: data.uid,
          text: data.text,
          provinceCode: data.provinceCode,
          status: data.status,
          createdAt: (data.createdAt as Timestamp | null)?.toDate().toISOString() ?? '',
        };
      });
    },

    async markReviewed(s: ServiceSuggestion) {
      const batch = writeBatch(db);
      batch.update(doc(db, SUGGESTIONS, s.id), { status: 'incelendi', reviewedBy: actorUid, reviewedAt: serverTimestamp() });
      // Öneri metni kullanıcı yazısıdır; kayda yalnızca kimlik yazılır (kişisel veri yazılmaz).
      audit(batch, 'duzenle', s.id, 'Hizmet önerisi incelendi');
      await batch.commit();
    },
  };
}
