/**
 * "Çevir" düğmesi (Karar Eren, 6 Kasım 2026; PROJE.md bölüm 2). Kullanıcı içeriği kendiliğinden çevrilmez; okuyan
 * düğmeye basınca sunucu metni okuyanın uygulama diline çevirir. Aynı metin aynı dile bir kez çevrilip saklanır
 * (maliyet ilkesi), kişi başına günlük sınır Panel > Sınırlar'dan (`ceviri`).
 */
import type { LanguageCode } from '../i18n/languages';

/** Tek seferde çevrilecek en uzun metin (gönderi ve ilan açıklaması sınırlarını karşılar). */
export const TRANSLATE_MAX_CHARS = 2000;

/** Sunucu işlevinin cevabı. `same`: metin zaten istenen dilde (çeviri gösterilmez). */
export interface TranslationResult {
  text: string;
  /** Sağlayıcının bulduğu kaynak dil (örn. "tr"); bilinmiyorsa boş. */
  source: string;
  same: boolean;
}

const STOP: Record<'tr' | 'en' | 'de', ReadonlySet<string>> = {
  tr: new Set(['ve', 'bir', 'bu', 'için', 'ile', 'çok', 'da', 'de', 'mi', 'ne', 'var', 'yok', 'gibi', 'daha', 'ama', 'olan', 'en', 'şu', 'her', 'biz', 'ben', 'sen', 'bugün', 'yarın', 'merhaba']),
  en: new Set(['the', 'and', 'is', 'are', 'to', 'of', 'for', 'with', 'you', 'this', 'that', 'in', 'on', 'it', 'we', 'was', 'have', 'be', 'not', 'at', 'my', 'today', 'hello']),
  de: new Set(['und', 'der', 'die', 'das', 'ist', 'nicht', 'mit', 'für', 'ein', 'eine', 'ich', 'zu', 'auf', 'sind', 'wir', 'sie', 'es', 'den', 'dem', 'auch', 'heute', 'hallo']),
};

/**
 * Metnin dilini kabaca tahmin eder (yalnızca düğmeyi gösterip göstermemek için; asıl tespiti sunucu yapar).
 * Emin değilse `null` döner.
 */
export function guessLanguage(text: string): LanguageCode | null {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length < 2) return null;
  const arabic = letters.filter((ch) => /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(ch)).length;
  const cyrillic = letters.filter((ch) => /[Ѐ-ӿ]/.test(ch)).length;
  if (arabic * 2 > letters.length) return 'ar';
  if (cyrillic * 2 > letters.length) return 'ru';
  if (arabic + cyrillic > 0) return null;
  if (/[ğĞşŞıİ]/.test(text)) return 'tr';
  const words = text.toLocaleLowerCase('tr').match(/\p{L}+/gu) ?? [];
  const score = { tr: 0, en: 0, de: 0 };
  for (const w of words) for (const l of ['tr', 'en', 'de'] as const) if (STOP[l].has(w)) score[l] += 1;
  if (/[äß]/i.test(text)) score.de += 2;
  const ranked = (Object.entries(score) as ['tr' | 'en' | 'de', number][]).sort((a, b) => b[1] - a[1]);
  return ranked[0][1] > 0 && ranked[0][1] > ranked[1][1] ? ranked[0][0] : null;
}

/** "Çevir" düğmesi gösterilsin mi: metin boş değil ve okuyanın dilinde görünmüyor (emin değilse gösterilir). */
export function canOfferTranslation(text: string | null | undefined, readerLanguage: LanguageCode): boolean {
  const s = (text ?? '').trim();
  if (!s || !/\p{L}/u.test(s)) return false;
  return guessLanguage(s) !== readerLanguage;
}

/** Sunucuya gidecek metin: baştaki / sondaki boşluk atılır, sınırda kesilir. */
export const translationInput = (text: string) => text.trim().slice(0, TRANSLATE_MAX_CHARS);
