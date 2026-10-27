import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

import type { Action, Module } from '../permissions/types';
import { DEFAULT_OCCUPATIONS } from '../services/occupations';
import type { Occupation } from '../services/types';

/** Panel: admin olup olmadığını sunucudaki admin listesinden okur. */
export async function isAdminAccount(db: Firestore, uid: string): Promise<boolean> {
  try {
    return (await getDoc(doc(db, 'admins', uid))).exists();
  } catch {
    return false;
  }
}

/**
 * Meslek listesi yönetimi (admin). Her değişiklik aynı toplu yazımda işlem kaydına da eklenir;
 * kayıt yazılamazsa değişiklik de yapılmaz.
 */
export function createOccupationAdmin(db: Firestore, actorUid: string) {
  const audit = (batch: ReturnType<typeof writeBatch>, action: Action, targetId: string, summary: string) => {
    const module: Module = 'meslekler';
    batch.set(doc(collection(db, 'auditLog')), { actorUid, module, action, targetId, at: serverTimestamp(), summary });
  };
  const toData = (o: Occupation) => ({
    names: Object.fromEntries(Object.entries(o.names).filter(([, v]) => !!v?.trim()).map(([k, v]) => [k, v!.trim()])),
    order: o.order,
    active: o.active,
    updatedBy: actorUid,
    updatedAt: serverTimestamp(),
  });

  return {
    /** Veritabanındaki tüm meslekler (pasifler dahil), sıralı. */
    async listAll(): Promise<Occupation[]> {
      const snap = await getDocs(collection(db, 'occupations'));
      return snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Occupation, 'id'>) }))
        .sort((a, b) => a.order - b.order);
    },

    async save(o: Occupation, isNew: boolean) {
      const batch = writeBatch(db);
      batch.set(doc(db, 'occupations', o.id), toData(o));
      audit(batch, isNew ? 'ekle' : 'duzenle', o.id, `${isNew ? 'Eklendi' : 'Düzenlendi'}: ${o.names.tr}`);
      await batch.commit();
    },

    async setActive(o: Occupation, active: boolean) {
      const batch = writeBatch(db);
      batch.set(doc(db, 'occupations', o.id), toData({ ...o, active }));
      audit(batch, 'duzenle', o.id, `${active ? 'Etkinleştirildi' : 'Pasifleştirildi'}: ${o.names.tr}`);
      await batch.commit();
    },

    /** Başlangıç listesini veritabanına yükler (yalnızca eksik olanları). */
    async seedDefaults(existingIds: Set<string>) {
      const missing = DEFAULT_OCCUPATIONS.filter((o) => !existingIds.has(o.id));
      if (!missing.length) return 0;
      const batch = writeBatch(db);
      for (const o of missing) batch.set(doc(db, 'occupations', o.id), toData(o));
      audit(batch, 'ekle', 'varsayilan-liste', `Başlangıç meslek listesi yüklendi (${missing.length} meslek)`);
      await batch.commit();
      return missing.length;
    },
  };
}

/** Meslek kimliği: Türkçe addan üretilir ("Avukat / hukukçu" -> "avukat-hukukcu"). */
export function occupationIdFromName(name: string): string {
  const map: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
  return name
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşü]/g, (ch) => map[ch] ?? ch)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
