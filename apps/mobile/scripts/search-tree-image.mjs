// Ara ekranının ağaç resmini (assets/search/agac.jpg) WebView'e gömülecek veri dosyasına çevirir.
// Kullanım (apps/mobile içinde): node scripts/search-tree-image.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const b64 = readFileSync(new URL('../assets/search/agac.jpg', import.meta.url)).toString('base64');
const out = new URL('../src/components/search-tree/tree-image.ts', import.meta.url);
writeFileSync(
  out,
  `/**
 * Ara ekranının ağaç resmi (Eren, 10 Kasım 2026; kaynak assets/search/agac.jpg, 900x1752). Işık katmanı resmin
 * piksellerinden kabuğu bulduğu için resim WebView içine veri olarak gömülür (dosya yolu kısıtlarına takılmaz).
 * Resim değişirse: node scripts/search-tree-image.mjs
 */
export const TREE_IMAGE = 'data:image/jpeg;base64,${b64}';
`,
);
console.log('yazıldı:', out.pathname);
