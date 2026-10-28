import { doc, getDoc, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore';

import { cleanBannedWords } from '../posts/word-filter';
import { addAudit } from './grants';

const ref = (db: Firestore) => doc(db, 'config', 'bannedWords');

/** Yasaklı kelime listesi: uygulama okur (oturum başına bir kez), admin panelden yönetir; her değişiklik kayda geçer. */
export function createBannedWords(db: Firestore) {
  return {
    async get(): Promise<string[]> {
      const snap = await getDoc(ref(db));
      const words: unknown = snap.exists() ? snap.get('words') : [];
      return Array.isArray(words) ? words.filter((w): w is string => typeof w === 'string') : [];
    },

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
