/**
 * Türkçe özel adın belirtme hâli ("Bursa" → "Bursa'yı", "İstanbul" → "İstanbul'u", "Çanakkale" → "Çanakkale'yi").
 * Büyük ünlü uyumuna göre ek seçilir; ünlüyle biten adlara kaynaştırma "y" eklenir. Yalnızca Türkçe arayüzde kullanılır.
 */
const NARROW: Record<string, string> = { a: 'ı', ı: 'ı', e: 'i', i: 'i', o: 'u', u: 'u', ö: 'ü', ü: 'ü' };

export function trAccusative(name: string): string {
  const lower = name.trim().toLocaleLowerCase('tr');
  if (!lower) return name;
  const vowels = [...lower].filter((ch) => ch in NARROW);
  const last = vowels.at(-1);
  if (!last) return name;
  const endsWithVowel = lower.at(-1)! in NARROW;
  return `${name.trim()}’${endsWithVowel ? 'y' : ''}${NARROW[last]}`;
}
