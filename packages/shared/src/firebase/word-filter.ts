import { doc, getDoc, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore';

import { DEFAULT_BANNED_WORDS } from '../posts/default-banned-words';
import { cleanBannedWords } from '../posts/word-filter';
import { addAudit } from './grants';

const ref = (db: Firestore) => doc(db, 'config', 'bannedWords');

/** Yasaklı kelime listesi: uygulama okur (oturum başına bir kez), admin panelden yönetir; her değişiklik kayda geçer. */
export function createBannedWords(db: Firestore) {
  const load = async (): Promise<{ words: string[]; saved: boolean }> => {
    const snap = await getDoc(ref(db));
    if (!snap.exists()) return { words: [...DEFAULT_BANNED_WORDS], saved: false };
    const words: unknown = snap.get('words');
    return { words: Array.isArray(words) ? words.filter((w): w is string => typeof w === 'string') : [], saved: true };
  };

  return {
    /** Geçerli liste: panelde hiç kaydedilmemişse CityJoy'un hazır listesi. */
    async get(): Promise<string[]> {
      return (await load()).words;
    },

    /** Liste ve panelde kaydedilip kaydedilmediği (kaydedilmemişse hazır liste döner). */
    load,

    async save(actorUid: string, lines: string[]): Promise<string[]> {
      const words = cleanBannedWords(lines);
      const batch = writeBatch(db);
      batch.set(ref(db), { words, updatedBy: actorUid, updatedAt: serverTimestamp() });
      addAudit(db, batch, { actorUid, module: 'moderasyon', action: 'duzenle', targetId: 'bannedWords', summary: `Yasaklı kelime listesi güncellendi (${words.length} kelime)` });
      await batch.commit();
      return words;
    },
  };
}
