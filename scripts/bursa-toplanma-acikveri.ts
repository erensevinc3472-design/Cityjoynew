// Bursa Büyükşehir açık veri (Bursa Açık Veri Lisansı) toplanma alanları GeoJSON'unu şehir rehberi Excel'ine çevirir.
// Önce: curl -o veri-denemesi/acikveri/toplanma.geojson https://bapi.bursa.bel.tr/apigateway/bbbAcikVeri_Cbs/Toplanma_yerleri
// Çalıştırma: npx vite-node scripts/bursa-toplanma-acikveri.ts -- <çıktı.xlsx>
import { readFileSync } from 'node:fs';
import writeExcelFile from 'write-excel-file/node';
import { citySection } from '@cityjoy/shared';
import districts from '../packages/shared/data/locations/districts.json';

const out = process.argv[process.argv.length - 1]!;
const SOURCE = 'https://acikyesil.bursa.bel.tr/tr/dataset/toplanma-alanlari';
const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const title = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr').split(/(\s+|-)/).map((w) => w.charAt(0).toLocaleUpperCase('tr') + w.slice(1)).join('');
const bursa = districts.filter((d) => d.provinceCode === '16');
const district = (s: string) => bursa.find((d) => d.name.toLocaleLowerCase('tr') === s.toLocaleLowerCase('tr'))?.name;
const j = JSON.parse(readFileSync('veri-denemesi/acikveri/toplanma.geojson', 'utf8'));
// Alanın orta noktası: dış halkanın köşe ortalaması (küçük alanlarda yeterli).
const center = (g: any) => { const pts = g.coordinates.flatMap((p: any) => p[0]); return [pts.reduce((a: number, p: number[]) => a + p[1], 0) / pts.length, pts.reduce((a: number, p: number[]) => a + p[0], 0) / pts.length]; };
const keys = citySection('toplanma-alanlari')!.columns.map((c) => c.key);
const rows: Record<string, string>[] = [];
const seen = new Map<string, number>();
let skipped = 0;
for (const f of j.features) {
  const p = f.properties; const ilce = district(p.ilce ?? '');
  if (!ilce || !p.ad?.trim() || !f.geometry) { skipped++; continue; }
  const [lat, lng] = center(f.geometry);
  const mahalle = p.mahalle ? title(p.mahalle) : '';
  let ad = p.ad.trim().replace(/\s+/g, ' ');
  const k = `${ilce}|${ad.toLocaleLowerCase('tr').replace(/[.\s]+$/, '')}`;
  const n = (seen.get(k) ?? 0) + 1; seen.set(k, n);
  if (n > 1) ad = `${ad} (${mahalle || n})`;
  rows.push({ ad, il: 'Bursa', ilce, mahalle, enlem: lat.toFixed(6), boylam: lng.toFixed(6), kaynak: SOURCE, kaynak_tarihi: today, not: 'Bursa Büyükşehir Belediyesi açık verisi' });
}
await writeExcelFile([{ sheet: 'Toplanma Alanları', data: [keys, ...rows.map((r) => keys.map((k) => r[k] ?? ''))].map((r) => r.map((value) => ({ value, type: String }))) as any, stickyRowsCount: 1 }]).toFile(out);
console.log(`${rows.length} alan, ${skipped} atlandı -> ${out}`);
