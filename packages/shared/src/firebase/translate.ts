import { httpsCallable, type Functions } from 'firebase/functions';

import type { LanguageCode } from '../i18n/languages';
import { LimitReachedError } from '../limits/limits';
import { translationInput, type TranslationResult } from '../translate/translate';

/** "Çevir" düğmesinin sunucu çağrısı (işlev: `translate`). Günlük hak dolunca `LimitReachedError('ceviri')` atar. */
export function createTranslationClient(functions: Functions) {
  const call = httpsCallable<{ text: string; target: LanguageCode }, TranslationResult>(functions, 'translate');
  return async function translate(text: string, target: LanguageCode): Promise<TranslationResult> {
    try {
      return (await call({ text: translationInput(text), target })).data;
    } catch (e) {
      const err = e as { code?: string; details?: { resetAt?: string } };
      if (err.code === 'functions/resource-exhausted') throw new LimitReachedError('ceviri', err.details?.resetAt ?? '');
      throw e;
    }
  };
}
