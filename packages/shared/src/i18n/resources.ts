import ar from './locales/ar.json';
import de from './locales/de.json';
import en from './locales/en.json';
import ru from './locales/ru.json';
import tr from './locales/tr.json';
import type { LanguageCode } from './languages';

/** Türkçe dosya ana kaynaktır; diğer diller aynı anahtarları taşımalıdır (test kontrol eder). */
export type Translation = typeof tr;

export const translations: Record<LanguageCode, Translation> = { tr, en, de, ar, ru };
