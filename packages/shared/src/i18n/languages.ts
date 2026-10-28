export const LANGUAGES = [
  { code: 'tr', nativeName: 'Türkçe', rtl: false },
  { code: 'en', nativeName: 'English', rtl: false },
  { code: 'de', nativeName: 'Deutsch', rtl: false },
  { code: 'ar', nativeName: 'العربية', rtl: true },
  { code: 'ru', nativeName: 'Русский', rtl: false },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

export const DEFAULT_LANGUAGE: LanguageCode = 'tr';

export function isLanguageCode(value: unknown): value is LanguageCode {
  return LANGUAGES.some((l) => l.code === value);
}

export function isRtl(code: LanguageCode): boolean {
  return LANGUAGES.find((l) => l.code === code)?.rtl ?? false;
}

/** Cihazın dil listesinden desteklenen ilk dili seçer (örn. ["de-DE", "en-US"] -> "de"). */
export function pickLanguage(deviceLanguageTags: readonly string[]): LanguageCode {
  for (const tag of deviceLanguageTags) {
    const code = tag.toLowerCase().split(/[-_]/)[0];
    if (isLanguageCode(code)) return code;
  }
  return DEFAULT_LANGUAGE;
}

/**
 * Telefon, e-posta gibi her dilde soldan sağa okunan değeri metin içinde yalıtır (Unicode LRI ... PDI); Arapça
 * metinde "0532 000 00 00" ters dönmez.
 */
export const ltr = (s: string) => `\u2066${s}\u2069`;
