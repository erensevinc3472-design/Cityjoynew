import { createTranslationClient } from '@cityjoy/shared/firebase';
import type { LanguageCode, TranslationResult } from '@cityjoy/shared';

import { functions } from './firebase';

const client = createTranslationClient(functions);
// Oturum boyunca aynı metin aynı dile ikinci kez sunucuya sorulmaz (liste kaydırılıp geri gelince de).
const memo = new Map<string, Promise<TranslationResult>>();

export function translateText(text: string, target: LanguageCode): Promise<TranslationResult> {
  const key = `${target}\u0000${text}`;
  let p = memo.get(key);
  if (!p) {
    p = client(text, target);
    memo.set(key, p);
    p.catch(() => memo.delete(key));
  }
  return p;
}
