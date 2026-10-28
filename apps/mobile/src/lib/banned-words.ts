import { useEffect, useState } from 'react';
import { findBannedWord } from '@cityjoy/shared';
import { createBannedWords } from '@cityjoy/shared/firebase';

import { firestore } from './firebase';

/** Yasaklı kelime listesi: oturum başına bir okuma. Okunamazsa boş liste (paylaşım engellenmez, şikâyet yine çalışır). */
let words: string[] | null = null;
let loading: Promise<string[]> | null = null;

function load(): Promise<string[]> {
  loading ??= createBannedWords(firestore).get().then(
    (w) => (words = w),
    () => {
      loading = null;
      return [];
    },
  );
  return loading;
}

/** Döner: metinde yasaklı kelime var mı denetleyen işlev. */
export function useBannedWordCheck() {
  const [, setReady] = useState(words !== null);
  useEffect(() => {
    if (words === null) load().then(() => setReady(true));
  }, []);
  return (...texts: string[]) => texts.some((x) => !!findBannedWord(x, words ?? []));
}
