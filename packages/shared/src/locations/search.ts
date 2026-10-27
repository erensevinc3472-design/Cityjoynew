const FOLD: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', i̇: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

/** Aramada Türkçe karakter ve büyük/küçük harf farkını yok sayar ("İnegöl" ~ "inegol"). */
export function foldForSearch(text: string): string {
  return text
    .toLocaleLowerCase('tr')
    .replace(/i̇|[çğıöşüâîû]/g, (ch) => FOLD[ch] ?? ch)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Sorguyla eşleşenleri döndürür; adı sorguyla başlayanlar önce gelir. */
export function filterByName<T extends { name: string }>(items: readonly T[], query: string): T[] {
  const q = foldForSearch(query);
  if (!q) return [...items];
  const starts: T[] = [];
  const contains: T[] = [];
  for (const item of items) {
    const name = foldForSearch(item.name);
    if (name.startsWith(q)) starts.push(item);
    else if (name.includes(q)) contains.push(item);
  }
  return [...starts, ...contains];
}
