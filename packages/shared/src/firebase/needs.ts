import { doc, getDoc, serverTimestamp, writeBatch, type Firestore } from './metered';

import { NEED_MAX_SERVICES, NEED_SITUATIONS, type NeedMap } from '../services/needs';
import { addAudit } from './grants';

const ref = (db: Firestore) => doc(db, 'config', 'needs');

/**
 * Diğer İhtiyaçlar eşleşmesi (13. madde 35): hangi durum kartı hangi hizmetleri açar. Admin panelden belirler (işlem
 * kaydına geçer), uygulama tek okumayla alır; belge yoksa paylaşılan varsayılan kullanılır (resolveNeedMap).
 */
export function createNeedsConfig(db: Firestore) {
  return {
    /** Ham eşleşme; belge yoksa null. */
    async get(): Promise<Partial<Record<string, unknown>> | null> {
      const snap = await getDoc(ref(db));
      const map: unknown = snap.exists() ? snap.get('map') : null;
      return map && typeof map === 'object' ? (map as Record<string, unknown>) : null;
    },

    async save(actorUid: string, map: NeedMap): Promise<void> {
      const clean = Object.fromEntries(NEED_SITUATIONS.map((s) => [s, [...new Set(map[s] ?? [])].slice(0, NEED_MAX_SERVICES)]));
      const batch = writeBatch(db);
      batch.set(ref(db), { map: clean, updatedBy: actorUid, updatedAt: serverTimestamp() });
      addAudit(db, batch, { actorUid, module: 'moderasyon', action: 'duzenle', targetId: 'needs', summary: 'Diğer İhtiyaçlar eşleşmesi güncellendi' });
      await batch.commit();
    },
  };
}
