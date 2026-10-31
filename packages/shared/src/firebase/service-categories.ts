import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
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
import { countUsage } from './limits';

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
  const batch = writeBatch(db);
  await countUsage(db, batch, { type: 'u', id: uid }, 'oneri', uid);
  batch.set(doc(collection(db, SUGGESTIONS)), {
    uid,
    text: text.trim(),
    ...(provinceCode ? { provinceCode } : {}),
    status: 'yeni',
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

/** Hesap silinirken kişinin gönderdiği öneriler de silinir (KVKK). */
export async function deleteServiceSuggestionsOf(db: Firestore, uid: string) {
  const snap = await getDocs(query(collection(db, SUGGESTIONS), where('uid', '==', uid)));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/**
 * Hizmet kategorisi yönetimi (admin, ülke geneli). Her değişiklik aynı toplu yazımda işlem kaydına ve
 * sürüm belgesine de yazılır; biri yazılamazsa hiçbiri yazılmaz.
 */
export function createServiceCategoryAdmin(db: Firestore, actorUid: string) {
  const module: Module = 'hizmet-kategorileri';
  const audit = (batch: ReturnType<typeof writeBatch>, action: Action, targetId: string, summary: string, provinceCode?: string) => {
    batch.set(doc(collection(db, 'auditLog')), {
      actorUid,
      module,
      action,
      targetId,
      ...(provinceCode ? { region: { provinceCode } } : {}),
      at: serverTimestamp(),
      summary,
    });
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

    /** Aynı üst kategorideki kategorilerin yeni sırası (1'den başlar); yalnızca yeri değişenler yazılır. */
    async reorder(list: ServiceCategory[]): Promise<number> {
      const changed = list.map((c, i) => ({ ...c, order: i + 1 })).filter((c, i) => list[i]!.order !== c.order);
      if (!changed.length) return 0;
      const batch = writeBatch(db);
      for (const c of changed) batch.set(doc(db, COLLECTION, c.id), toData(c));
      bumpVersion(batch);
      audit(batch, 'duzenle', 'siralama', `Hizmet kategorisi sıralaması değiştirildi (${changed.length} kayıt)`);
      await batch.commit();
      return changed.length;
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
    /** İl verilirse yalnızca o ilin önerileri (il yöneticisi kendi ilini görür; kurallar bunu şart koşar). */
    async listSuggestions(opts: { provinceCode?: string; max?: number } = {}): Promise<ServiceSuggestion[]> {
      const constraints = [orderBy('createdAt', 'desc'), limit(opts.max ?? 100)];
      const snap = await getDocs(
        opts.provinceCode
          ? query(collection(db, SUGGESTIONS), where('provinceCode', '==', opts.provinceCode), ...constraints)
          : query(collection(db, SUGGESTIONS), ...constraints),
      );
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
      audit(batch, 'onayla', s.id, 'Hizmet önerisi incelendi', s.provinceCode);
      await batch.commit();
    },
  };
}
