import type { LanguageCode } from '../i18n/languages';
import { foldForSearch } from '../locations/search';

/**
 * Ara (PROJE.md 5.10). Firestore'da metin içinde arama yoktur ve ücretli arama hizmeti kullanılmıyor. Bu yüzden
 * kişi adı, işletme adı ve gönderi yazısından "arama anahtarları" üretilir: her kelimenin baş kısımları
 * ("berber" > "be", "ber", "berb"...), Türkçe karakter ve büyük/küçük harf farkı olmadan. Sorgu bu anahtarlardan
 * biriyle eşleşen belgeleri getirir, kalan kelimeler telefonda süzülür.
 */
export const SEARCH_TABS = ['tumu', 'kisiler', 'isletmeler', 'yerler', 'etkinlikler', 'gonderiler'] as const;
export type SearchTab = (typeof SEARCH_TABS)[number];

export const SEARCH_LIMITS = {
  /** Anahtar en çok bu kadar harf; daha uzun sorgunun kalanı telefonda süzülür. */
  keyLength: 10,
  /** Kişi ve işletme adlarında en kısa anahtar; gönderilerde dizin küçük kalsın diye 3. */
  minName: 2,
  minPost: 3,
  profileKeys: 40,
  businessKeys: 60,
  postKeys: 300,
  /** Son aramalar telefonda saklanır. */
  recent: 10,
  /** Panelden girilen önerilen aramalar (dil başına). */
  suggestions: 12,
  suggestionLength: 40,
} as const;

/** Sorgu ve metin aynı biçime getirilir: küçük harf, Türkçe karakter yok, noktalama boşluk. */
export function searchWords(text: string): string[] {
  return foldForSearch(text)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter(Boolean);
}

/** Metnin arama anahtarları (kelime başları). Sınır dolunca sonraki kelimeler eklenmez. */
export function searchKeys(text: string, max: number, min: number = SEARCH_LIMITS.minName): string[] {
  const keys = new Set<string>();
  for (const word of new Set(searchWords(text))) {
    for (let n = min; n <= Math.min(word.length, SEARCH_LIMITS.keyLength); n++) {
      if (keys.size >= max) return [...keys];
      keys.add(word.slice(0, n));
    }
  }
  return [...keys];
}

/**
 * Veritabanına sorulacak anahtar: sorgunun en uzun kelimesi (en seçici olan). Kelime çok kısaysa null.
 * Yazım hatasına tolerans için kısaltılmış hâlleri de döner ("berbr" > "berbr", "berb", "ber"): ilk anahtar sonuç
 * vermezse sıradaki denenir.
 */
export function searchKeyCandidates(query: string, min: number = SEARCH_LIMITS.minName): string[] {
  const longest = searchWords(query).sort((a, b) => b.length - a.length)[0] ?? '';
  const key = longest.slice(0, SEARCH_LIMITS.keyLength);
  if (key.length < min) return [];
  const out = [key];
  for (let n = key.length - 1; n >= Math.max(min, 3) && out.length < 3; n--) out.push(key.slice(0, n));
  return out;
}

/** a ile b arasında en çok bir harf farkı (eksik, fazla ya da yanlış harf) var mı. */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/**
 * Metin sorguyla eşleşiyor mu: sorgudaki her kelime metindeki bir kelimenin başıyla eşleşmeli. Hoşgörülü modda 5 ve
 * daha uzun kelimelerde bir yanlış ya da eksik harf kabul edilir ("berbr" ~ "berber", "eczne" ~ "eczane"). Daha kısa
 * kelimelerde tolerans, ilgisiz sonuç getirdiği için yok ("park" ~ "parça" olmasın).
 */
export function matchesSearch(text: string, query: string, tolerant = true): boolean {
  const q = searchWords(query);
  if (!q.length) return false;
  const words = searchWords(text);
  return q.every((qw) =>
    words.some(
      (w) =>
        w.startsWith(qw) ||
        (tolerant && qw.length >= 5 && (withinOneEdit(w.slice(0, qw.length), qw) || withinOneEdit(w.slice(0, qw.length + 1), qw))),
    ),
  );
}

/** Kesin eşleşmeler önce, yazım hatasıyla bulunanlar sonra. */
export function filterBySearch<T>(items: readonly T[], query: string, text: (item: T) => string): T[] {
  const exact: T[] = [];
  const close: T[] = [];
  for (const item of items) {
    const t = text(item);
    if (matchesSearch(t, query, false)) exact.push(item);
    else if (matchesSearch(t, query, true)) close.push(item);
  }
  return [...exact, ...close];
}

/** Son aramalar: en yeni başta, aynısı tekrar eklenmez, en çok 10. */
export function pushRecentSearch(list: readonly string[], query: string): string[] {
  const q = query.trim().replace(/\s+/g, ' ').slice(0, SEARCH_LIMITS.suggestionLength);
  if (q.length < SEARCH_LIMITS.minName) return [...list];
  const key = foldForSearch(q);
  return [q, ...list.filter((x) => foldForSearch(x) !== key)].slice(0, SEARCH_LIMITS.recent);
}

/** Önerilen aramalar, dil başına (panelden; boşsa uygulamadaki varsayılan liste). */
export type SearchSuggestions = Partial<Record<LanguageCode, string[]>>;

/** Panel girişini temizler: satır başına bir öneri, boşluklar kırpılır, tekrarlar atılır, en çok 12. */
export function cleanSuggestions(lines: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const s = raw.trim().replace(/\s+/g, ' ');
    if (s.length < SEARCH_LIMITS.minName || s.length > SEARCH_LIMITS.suggestionLength) continue;
    const key = foldForSearch(s);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= SEARCH_LIMITS.suggestions) break;
  }
  return out;
}
