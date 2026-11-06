import { doc, getDoc, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore';

import { cleanImportantDay, IMPORTANT_DAY_LIMITS, type ImportantDay } from '../press/important-days';
import type { Action, Module, RegionScope } from '../permissions/types';
import { cleanTemplate, TEMPLATE_LIMITS, type PressTemplate } from '../press/templates';
import { addAudit } from './grants';

/**
 * Basın Masası > Önemli günler (PROJE.md 6.2). Ülke geneli liste `config/importantDays` (admin yazar, herkes okur);
 * kurumun yerel günleri `orgDays/{kurum}` (kurum yöneticisi ya da duyuru hazırlayan personel yazar, kurum üyeleri okur).
 * Her kayıt işlem kaydına girer.
 */
export function createImportantDaysService(db: Firestore, actorUid: string) {
  const national = () => doc(db, 'config', 'importantDays');
  const local = (orgId: string) => doc(db, 'orgDays', orgId);
  const read = async (ref: ReturnType<typeof national>): Promise<ImportantDay[] | null> => {
    const snap = await getDoc(ref);
    return snap.exists() && Array.isArray(snap.data().days) ? (snap.data().days as ImportantDay[]) : null;
  };

  return {
    /** Ülke geneli liste; hiç kaydedilmediyse null (panel başlangıç listesini gösterir). */
    loadNational: () => read(national()),
    /** Kurumun yerel günleri (yoksa boş). */
    loadLocal: async (orgId: string) => (await read(local(orgId))) ?? [],

    async saveNational(days: ImportantDay[]): Promise<void> {
      const batch = writeBatch(db);
      batch.set(national(), { days: days.slice(0, IMPORTANT_DAY_LIMITS.national).map(cleanImportantDay), updatedBy: actorUid, updatedAt: serverTimestamp() });
      addAudit(db, batch, { actorUid, module: 'gonderiler', action: 'duzenle', targetId: 'config/importantDays', scope: { level: 'ulke' }, summary: `Önemli günler listesi (${days.length} gün)` });
      await batch.commit();
    },

    /** Kurum yöneticisi "kurumlar / duzenle", personel "gonderiler / ekle" ile kaydeder (işlem kaydı kuralı buna göre). */
    async saveLocal(orgId: string, days: ImportantDay[], as: { module: Extract<Module, 'kurumlar' | 'gonderiler'>; action: Action }): Promise<void> {
      const batch = writeBatch(db);
      batch.set(local(orgId), { days: days.slice(0, IMPORTANT_DAY_LIMITS.local).map(cleanImportantDay), updatedBy: actorUid, updatedAt: serverTimestamp() });
      addAudit(db, batch, { actorUid, module: as.module, action: as.action, targetId: `orgDays/${orgId}`, orgId, summary: `Yerel önemli günler (${days.length} gün)` });
      await batch.commit();
    },
  };
}

/**
 * Basın Masası > Hazır şablonlar: `pressTemplates/{hesap}` (kurum kimliği ya da kişi yetkisinin anahtarı). Hesabın
 * yöneticisi ve duyuru hazırlayabilenler yazar ve okur; kayıt işlem kaydına girer.
 */
export function createPressTemplatesService(db: Firestore, actorUid: string) {
  const ref = (key: string) => doc(db, 'pressTemplates', key);
  return {
    async load(key: string): Promise<PressTemplate[]> {
      const snap = await getDoc(ref(key));
      return snap.exists() && Array.isArray(snap.data().items) ? (snap.data().items as PressTemplate[]) : [];
    },
    /** as: işlem kaydının bölümü (kurum yöneticisi "kurumlar / duzenle", diğerleri "gonderiler / ekle"). */
    async save(
      key: string,
      items: PressTemplate[],
      as: { module: Extract<Module, 'kurumlar' | 'gonderiler'>; action: Action; orgId?: string; scope?: RegionScope },
    ): Promise<void> {
      const batch = writeBatch(db);
      batch.set(ref(key), { items: items.slice(0, TEMPLATE_LIMITS.max).map(cleanTemplate), updatedBy: actorUid, updatedAt: serverTimestamp() });
      addAudit(db, batch, {
        actorUid, module: as.module, action: as.action, targetId: `pressTemplates/${key}`,
        ...(as.orgId ? { orgId: as.orgId } : {}), ...(as.scope ? { scope: as.scope } : {}), summary: `Hazır şablonlar (${items.length})`,
      });
      await batch.commit();
    },
  };
}
