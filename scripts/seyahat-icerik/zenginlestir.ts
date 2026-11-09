// Birleşik Seyahat Excel'ine CityJoy'un "Hakkında" metinlerini, şehir bilgilerini (UNESCO) ve Bursa ek yerlerini işler:
//   npx vite-node scripts/seyahat-icerik/zenginlestir.ts -- dosya.xlsx   (dosyanın üstüne yazar)
import readXlsxFile from 'read-excel-file/node';
import writeExcelFile from 'write-excel-file/node';
import { normalizeName, TRAVEL_SHEETS } from '@cityjoy/shared';
import { BILGILER, HAKKINDA_BATI } from './hakkinda-bati';
import { BURSA_EK, HAKKINDA_DOGU } from './hakkinda-dogu';
import { HAKKINDA_ORTA } from './hakkinda-orta';

const f = process.argv.slice(2).filter((a) => a !== '--')[0]!;
const k = (il: string, ad: string) => `${normalizeName(il)}|${normalizeName(ad)}`;
const texts = new Map<string, string>();
for (const src of [HAKKINDA_BATI, HAKKINDA_ORTA, HAKKINDA_DOGU])
  for (const [il, places] of Object.entries(src)) for (const [ad, t] of Object.entries(places)) texts.set(k(il, ad), t);

const sheets = (await readXlsxFile(f)) as { sheet: string; data: unknown[][] }[];
const rows = (name: string) => {
  const s = sheets.find((x) => x.sheet === name)!;
  const h = s.data[0]!.map(String);
  return s.data.slice(1).map((r) => Object.fromEntries(h.map((c, i) => [c, String(r[i] ?? '')])) as Record<string, string>);
};
const used = new Set<string>();
const places = rows(TRAVEL_SHEETS.yer.sheet).filter((r) => normalizeName(r.il!) !== normalizeName('Bursa') || !BURSA_EK.some((b) => b.ad === r.ad));
let n = 0;
for (const r of places) {
  const t = texts.get(k(r.il!, r.ad!));
  if (t) { r.hakkinda = t; used.add(k(r.il!, r.ad!)); n++; }
}
places.push(...BURSA_EK);
const cities = rows(TRAVEL_SHEETS.sehir.sheet);
let b = 0;
for (const c of cities) {
  const extra = Object.entries(BILGILER).find(([il]) => normalizeName(il) === normalizeName(c.il!))?.[1];
  if (extra && !c.bilgiler) { c.bilgiler = extra; b++; }
}
const cell = (value: string) => ({ value, type: String });
const sheet = (d: { sheet: string; columns: readonly string[] }, rs: Record<string, string>[]) => ({
  sheet: d.sheet, data: [d.columns.map(cell), ...rs.map((r) => d.columns.map((c) => cell(r[c] ?? '')))] as any, stickyRowsCount: 1,
});
await writeExcelFile([sheet(TRAVEL_SHEETS.bolge, rows(TRAVEL_SHEETS.bolge.sheet)), sheet(TRAVEL_SHEETS.sehir, cities), sheet(TRAVEL_SHEETS.yer, places)]).toFile(f);
const unused = [...texts.keys()].filter((x) => !used.has(x));
const missing = places.filter((r) => r.hakkinda === r.ozet).map((r) => `${r.il}|${r.ad}`);
console.log(`hakkında yazıldı ${n}, şehir bilgisi ${b}, Bursa ek ${BURSA_EK.length}`);
console.log('eşleşmeyen metin:', unused);
console.log('hâlâ özetle aynı:', missing);
