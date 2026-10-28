import { collection, doc, getDocs, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore';

import {
  DEFAULT_EMERGENCY_NUMBERS,
  normalizePhoneNumber,
  type EmergencyNumber,
  type EmergencyNumberRepository,
  type LocalizedText,
} from '../emergency/numbers';
import type { Action, Module } from '../permissions/types';

const COLLECTION = 'emergencyNumbers';

async function listAll(db: Firestore): Promise<EmergencyNumber[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<EmergencyNumber, 'id'>) }))
    .sort((a, b) => a.order - b.order);
}

/** Uygulama: acil numaraları herkes okur (girişsiz de). */
export function createFirestoreEmergencyNumberRepository(db: Firestore): EmergencyNumberRepository {
  return { listAll: () => listAll(db) };
}

const cleanText = (text: LocalizedText | undefined) =>
  Object.fromEntries(Object.entries(text ?? {}).filter(([, v]) => !!v?.trim()).map(([k, v]) => [k, v!.trim()]));

/**
 * Acil numara yönetimi (admin, ülke geneli). Her değişiklik aynı toplu yazımda işlem kaydına da
 * eklenir; kayıt yazılamazsa değişiklik de yapılmaz.
 */
export function createEmergencyNumberAdmin(db: Firestore, actorUid: string) {
  const audit = (batch: ReturnType<typeof writeBatch>, action: Action, targetId: string, summary: string) => {
    const module: Module = 'acil-numaralar';
    batch.set(doc(collection(db, 'auditLog')), { actorUid, module, action, targetId, at: serverTimestamp(), summary });
  };
  const toData = (n: EmergencyNumber) => {
    const notes = cleanText(n.notes);
    return {
      number: normalizePhoneNumber(n.number),
      names: cleanText(n.names),
      ...(Object.keys(notes).length ? { notes } : {}),
      icon: n.icon,
      order: n.order,
      active: n.active,
      updatedBy: actorUid,
      updatedAt: serverTimestamp(),
    };
  };
  const label = (n: EmergencyNumber) => `${normalizePhoneNumber(n.number)} ${n.names.tr.trim()}`;

  return {
    listAll: () => listAll(db),

    async save(n: EmergencyNumber, isNew: boolean) {
      const batch = writeBatch(db);
      batch.set(doc(db, COLLECTION, n.id), toData(n));
      audit(batch, isNew ? 'ekle' : 'duzenle', n.id, `${isNew ? 'Eklendi' : 'Düzenlendi'}: ${label(n)}`);
      await batch.commit();
    },

    /** Sürükleyerek verilen yeni sıra (1'den başlar); yalnızca yeri değişenler yazılır. Döner: değişen sayısı. */
    async reorder(list: EmergencyNumber[]): Promise<number> {
      const changed = list.map((n, i) => ({ ...n, order: i + 1 })).filter((n, i) => list[i]!.order !== n.order);
      if (!changed.length) return 0;
      const batch = writeBatch(db);
      for (const n of changed) batch.set(doc(db, COLLECTION, n.id), toData(n));
      audit(batch, 'duzenle', 'siralama', `Acil numara sıralaması değiştirildi (${changed.length} kayıt)`);
      await batch.commit();
      return changed.length;
    },

    async setActive(n: EmergencyNumber, active: boolean) {
      const batch = writeBatch(db);
      batch.set(doc(db, COLLECTION, n.id), toData({ ...n, active }));
      audit(batch, 'duzenle', n.id, `${active ? 'Etkinleştirildi' : 'Pasifleştirildi'}: ${label(n)}`);
      await batch.commit();
    },

    /** Başlangıç listesini veritabanına yükler (yalnızca eksik olanları). */
    async seedDefaults(existingIds: Set<string>) {
      const missing = DEFAULT_EMERGENCY_NUMBERS.filter((n) => !existingIds.has(n.id));
      if (!missing.length) return 0;
      const batch = writeBatch(db);
      for (const n of missing) batch.set(doc(db, COLLECTION, n.id), toData(n));
      audit(batch, 'ekle', 'varsayilan-liste', `Başlangıç acil numara listesi yüklendi (${missing.length} numara)`);
      await batch.commit();
      return missing.length;
    },
  };
}
