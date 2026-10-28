import { doc, getDoc, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore';

import { addAudit } from './grants';

const ref = (db: Firestore) => doc(db, 'config', 'introVideo');

/** Tanıtım videosu bağlantısı en çok bu uzunlukta, yalnızca https. */
export const INTRO_VIDEO_URL_MAX = 500;

/** Geçerli bir https bağlantısıysa kırpılmış hâli, değilse boş (boş = video yok). */
export function cleanVideoUrl(url: string): string {
  const u = url.trim();
  return /^https:\/\/[^\s]+$/i.test(u) && u.length <= INTRO_VIDEO_URL_MAX ? u : '';
}

/**
 * Ana sayfadaki "Tanıtım videosu" düğmesinin açtığı bağlantı (13. madde 29). Admin panelden girer (kayda geçer),
 * uygulama okur; bağlantı yoksa düğme "yakında" görünür. Video bir video sitesinde durur, uygulama yalnızca açar.
 */
export function createIntroVideo(db: Firestore) {
  return {
    async get(): Promise<string> {
      const snap = await getDoc(ref(db));
      const url: unknown = snap.exists() ? snap.get('url') : '';
      return typeof url === 'string' ? cleanVideoUrl(url) : '';
    },

    async save(actorUid: string, url: string): Promise<string> {
      const clean = cleanVideoUrl(url);
      const batch = writeBatch(db);
      batch.set(ref(db), { url: clean, updatedBy: actorUid, updatedAt: serverTimestamp() });
      addAudit(db, batch, { actorUid, module: 'moderasyon', action: 'duzenle', targetId: 'introVideo', summary: clean ? `Tanıtım videosu: ${clean}` : 'Tanıtım videosu kaldırıldı' });
      await batch.commit();
      return clean;
    },
  };
}
