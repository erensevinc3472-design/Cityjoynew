import ar from './locales/ar.json';
import de from './locales/de.json';
import en from './locales/en.json';
import ru from './locales/ru.json';
import tr from './locales/tr.json';
import type { LanguageCode } from './languages';

/** Türkçe dosya ana kaynaktır; diğer diller aynı anahtarları taşımalıdır (test kontrol eder). */
export type Translation = typeof tr;

/**
 * Rusça ve Arapçada çoğul biçimi çoktur (few, many, zero, two). Dosyalarda yalnızca _one / _other yazılır ("Районов: 3"
 * gibi sayıdan bağımsız biçim); eksik biçimler _other'dan doldurulur, yoksa i18next Türkçeye düşer.
 */
const EXTRA_PLURALS = ['zero', 'two', 'few', 'many'] as const;
export function fillPlurals<T>(node: T): T {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return node;
  const src = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) out[k] = fillPlurals(v);
  for (const [k, v] of Object.entries(src)) {
    if (!k.endsWith('_other') || typeof v !== 'string') continue;
    const base = k.slice(0, -'_other'.length);
    for (const form of EXTRA_PLURALS) if (!(`${base}_${form}` in out)) out[`${base}_${form}`] = v;
  }
  return out as T;
}

export const translations: Record<LanguageCode, Translation> = { tr, en, de, ar: fillPlurals(ar), ru: fillPlurals(ru) };
