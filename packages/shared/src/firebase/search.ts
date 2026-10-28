import { doc, getDoc, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore';

import { LANGUAGES } from '../i18n/languages';
import { cleanSuggestions, type SearchSuggestions } from '../search/search';
import { addAudit } from './grants';

const ref = (db: Firestore) => doc(db, 'config', 'searchSuggestions');

/**
 * Ara ekranındaki "Önerilen aramalar": admin panelden dil başına yazar (her değişiklik kayda geçer), uygulama oturum
 * başına bir kez okur. Bir dilde liste boşsa uygulama kendi varsayılan önerilerini gösterir.
 */
export function createSearchSuggestions(db: Firestore) {
  return {
    async get(): Promise<SearchSuggestions> {
      const snap = await getDoc(ref(db));
      const terms: unknown = snap.exists() ? snap.get('terms') : undefined;
      const out: SearchSuggestions = {};
      if (!terms || typeof terms !== 'object') return out;
      for (const { code } of LANGUAGES) {
        const list: unknown = (terms as Record<string, unknown>)[code];
        if (Array.isArray(list)) out[code] = list.filter((x): x is string => typeof x === 'string');
      }
      return out;
    },

    async save(actorUid: string, input: SearchSuggestions): Promise<SearchSuggestions> {
      const terms: SearchSuggestions = {};
      for (const { code } of LANGUAGES) terms[code] = cleanSuggestions(input[code] ?? []);
      const batch = writeBatch(db);
      batch.set(ref(db), { terms, updatedBy: actorUid, updatedAt: serverTimestamp() });
      const count = Object.values(terms).reduce((n, l) => n + (l?.length ?? 0), 0);
      addAudit(db, batch, { actorUid, module: 'moderasyon', action: 'duzenle', targetId: 'searchSuggestions', summary: `Önerilen aramalar güncellendi (${count} öneri)` });
      await batch.commit();
      return terms;
    },
  };
}
