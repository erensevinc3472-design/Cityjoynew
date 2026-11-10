// Bursa muhtarlık dosyasına OpenStreetMap'teki muhtarlık noktalarının harita konumunu ekler (ODbL, kaynak notta).
// Yalnızca adı tek bir mahalleye açıkça eşleşen noktalar alınır; aynı adlı iki mahalle varsa en yakın ilçe sınırı
// bilinmediği için atlanır. Önce: veri-denemesi/onbellek (OSM çekimi).
// Çalıştırma: npx vite-node scripts/bursa-muhtarlik-konum.ts -- <girdi.xlsx> <çıktı.xlsx>
import { readdirSync, readFileSync } from 'node:fs';
import readXlsxFile from 'read-excel-file/node';
import writeExcelFile from 'write-excel-file/node';
import { citySection } from '@cityjoy/shared';

const [inp, out] = process.argv.slice(-2) as [string, string];
const norm = (s: string) =>
  s.toLocaleLowerCase('tr').replace(/(mahallesi|mahalle|mah\.|köyü|muhtarlığı|muhtarlık|muhtarligi)/g, '').replace(/[^a-zçğıöşü0-9]/g, '');

type Pt = { id: number; name: string; lat: number; lon: number; type: string };
const pts = new Map<number, Pt>();
for (const f of readdirSync('veri-denemesi/onbellek')) {
  if (!f.startsWith('16-')) continue;
  let j: unknown;
  try { j = JSON.parse(readFileSync(`veri-denemesi/onbellek/${f}`, 'utf8')); } catch { continue; }
  for (const e of (Array.isArray(j) ? j : []) as { id: number; type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[]) {
    const name = e.tags?.name ?? '';
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
    if (/muhtar/i.test(name) && lat && lon) pts.set(e.id, { id: e.id, name, lat, lon, type: e.type });
  }
}

const [{ data }] = (await readXlsxFile(inp)) as unknown as [{ data: (string | number | null)[][] }];
const keys = data[0] as string[];
const rows = data.slice(1).map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] == null ? '' : String(r[i])])));
const byName = new Map<string, number[]>();
rows.forEach((r, i) => { const k = norm(r.mahalle!); byName.set(k, [...(byName.get(k) ?? []), i]); });

let added = 0;
const skipped: string[] = [];
for (const p of pts.values()) {
  const k = norm(p.name);
  const hit = k ? byName.get(k) : undefined;
  if (!hit || hit.length !== 1) { skipped.push(`${p.name}${hit ? ' (birden çok mahalle)' : ''}`); continue; }
  const r = rows[hit[0]!]!;
  if (r.enlem) continue;
  r.enlem = p.lat.toFixed(6);
  r.boylam = p.lon.toFixed(6);
  const src = `Konum: OpenStreetMap katkıcıları, ODbL (https://www.openstreetmap.org/${p.type}/${p.id})`;
  r.not = r.not ? `${r.not} • ${src}` : src;
  added++;
}

await writeExcelFile([{ sheet: citySection('muhtarliklar')!.sheet, data: [keys, ...rows.map((r) => keys.map((k) => r[k] ?? ''))].map((r) => r.map((value) => ({ value, type: String }))) as any, stickyRowsCount: 1 }]).toFile(out);
console.log(`OSM noktası ${pts.size}, konum eklenen ${added}, eşleşmeyen ${skipped.length}:`, skipped.join('; '));
