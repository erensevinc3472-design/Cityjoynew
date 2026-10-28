/**
 * Otomatik kelime süzgeci (Keşfet kuralları madde 8). Yasaklı kelime listesini admin panelden yönetir; uygulama gönderi,
 * yorum ve profil tanıtımında listeyi denetler ve paylaşımı durdurur. Süzgeç kusursuz değildir (yazımı değiştirerek
 * atlatılabilir); kaçanlar şikâyetle moderasyona düşer.
 */

export const BANNED_WORD_LIMITS = { count: 1000, length: [2, 40] } as const;

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '€': 'e' };

/** Karşılaştırma biçimi: küçük harf (Türkçe), aksan ve ı/i farkı yok, rakamla yazım düzeltilir, tekrarlanan harf teke iner. */
export function normalizeForFilter(text: string): string {
  return text
    .toLocaleLowerCase('tr')
    .replace(/[013457@$€]/g, (ch) => LEET[ch] ?? ch)
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/(\p{L})\1+/gu, '$1');
}

/** Panelde girilen listeyi temizler: boşluk, tekrar ve sınır dışı kelimeler atılır. */
export function cleanBannedWords(lines: string[]): string[] {
  const [min, max] = BANNED_WORD_LIMITS.length;
  const words = lines.map((w) => w.trim().toLocaleLowerCase('tr')).filter((w) => w.length >= min && w.length <= max);
  return [...new Set(words)].slice(0, BANNED_WORD_LIMITS.count);
}

/**
 * Metinde yasaklı kelime var mı. Kelime bir sözcüğe eşitse yakalanır; 4 harf ve üstü kelime sözcüğün başında da
 * yakalanır (ekli hâller). Birden çok sözcüklü ifade metnin içinde geçerse yakalanır. Döner: ilk bulunan kelime.
 */
export function findBannedWord(text: string, words: readonly string[]): string | null {
  if (!words.length) return null;
  const norm = normalizeForFilter(text);
  const tokens = norm.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const joined = ` ${tokens.join(' ')} `;
  for (const w of words) {
    const nw = normalizeForFilter(w).trim();
    if (!nw) continue;
    if (nw.includes(' ')) {
      if (joined.includes(` ${nw}`)) return w;
    } else if (tokens.some((tk) => tk === nw || (nw.length >= 4 && tk.startsWith(nw)))) return w;
  }
  return null;
}
