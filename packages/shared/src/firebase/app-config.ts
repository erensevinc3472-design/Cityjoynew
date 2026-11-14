import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, writeBatch, type Firestore } from './metered';

import { changedParts, normalizeAppConfig, type AppConfig, type AppConfigPart } from '../app-config/app-config';
import { addAudit, iso } from './grants';

const ref = (db: Firestore) => doc(db, 'config', 'app');
const HISTORY = 'appConfigHistory';

/** Uygulama: ayarı okur (açılışta bir kez). Kayıt yoksa varsayılanlar. */
export async function getAppConfig(db: Firestore): Promise<AppConfig> {
  const snap = await getDoc(ref(db));
  return normalizeAppConfig(snap.exists() ? snap.data() : null);
}

export interface AppConfigHistoryEntry {
  id: string;
  actorUid: string;
  at?: string;
  parts: AppConfigPart[];
  /** Değişiklikten önceki hâl ("Geri al" bunu geri yazar). */
  before: AppConfig;
  rollback: boolean;
}

const PART_LABEL: Record<AppConfigPart, string> = {
  banner: 'duyuru/bakım',
  update: 'güncelleme',
  closed: 'bölümler',
  images: 'görseller',
  contact: 'iletişim',
  legal: 'yasal metin',
};

/** Panel (yalnızca admin): ayarı yazar; değişiklik işlem kaydına ve ayar geçmişine aynı anda yazılır. */
export function createAppConfigAdmin(db: Firestore) {
  async function save(actorUid: string, next: AppConfig, rollback = false): Promise<AppConfig> {
    const before = await getAppConfig(db);
    const clean = normalizeAppConfig(next);
    const parts = changedParts(before, clean);
    if (!parts.length) return clean;
    const batch = writeBatch(db);
    batch.set(ref(db), { ...clean, updatedBy: actorUid, updatedAt: serverTimestamp() });
    batch.set(doc(collection(db, HISTORY)), { actorUid, at: serverTimestamp(), parts, before, rollback });
    addAudit(db, batch, {
      actorUid,
      module: 'moderasyon',
      action: 'duzenle',
      targetId: 'appConfig',
      summary: `${rollback ? 'Uygulama ayarı geri alındı' : 'Uygulama ayarları değişti'}: ${parts.map((p) => PART_LABEL[p]).join(', ')}`,
    });
    await batch.commit();
    return clean;
  }

  return {
    get: () => getAppConfig(db),
    save: (actorUid: string, next: AppConfig) => save(actorUid, next),
    /** Seçilen değişiklikten önceki hâle döner (bu da geçmişe yeni bir satır olarak yazılır). */
    rollback: (actorUid: string, entry: AppConfigHistoryEntry) => save(actorUid, entry.before, true),
    async history(max = 20): Promise<AppConfigHistoryEntry[]> {
      const snap = await getDocs(query(collection(db, HISTORY), orderBy('at', 'desc'), limit(max)));
      return snap.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id,
          actorUid: String(x.actorUid ?? ''),
          at: iso(x.at),
          parts: Array.isArray(x.parts) ? (x.parts as AppConfigPart[]) : [],
          before: normalizeAppConfig(x.before),
          rollback: x.rollback === true,
        };
      });
    },
  };
}
