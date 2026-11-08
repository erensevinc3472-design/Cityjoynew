// Bir şehir rehberi Excel'ini panelin denetiminden geçirir: npx vite-node scripts/check-city-guide.ts -- dosya.xlsx
import readXlsxFile from 'read-excel-file/node';
import { CITY_GUIDE_SECTIONS, parseCitySheet } from '@cityjoy/shared';
import districts from '../packages/shared/data/locations/districts.json';
import provinces from '../packages/shared/data/locations/provinces.json';
const file = process.argv[process.argv.length - 1]!;
const sheets = await readXlsxFile(file);
const ctx = { provinces, districts } as any;
const allErr: string[] = [];
for (const { sheet, data } of sheets as any[]) {
  const section = CITY_GUIDE_SECTIONS.find((s) => s.sheet === sheet);
  if (!section) { console.log(`[${sheet}] (bölüm değil) satır: ${data.length}`); continue; }
  const { items, errors, skipped } = parseCitySheet(section.id, data, ctx);
  const filled = data.slice(1).filter((r: any[]) => r.some((c) => c !== null && c !== '')).length;
  const noSrc = items.filter((i: any) => /openstreetmap/i.test(i.source ?? '')).length;
  const teyit = items.filter((i: any) => /teyit/i.test(String(i.values?.not ?? i.note ?? ''))).length;
  console.log(`[${sheet}] dolu satır ${filled}, geçerli ${items.length}, hatalı ${errors.length}, örnek ${skipped}, OSM kaynaklı ${noSrc}, teyit notlu ${teyit}`);
  errors.forEach((e: any) => allErr.push(`${e.sheet} r${e.row}: ${e.message}`));
}
console.log('\nHATALAR (' + allErr.length + '):');
const counts = new Map<string, number>();
for (const e of allErr) { const k = e.replace(/^.*?: /, '').replace(/".*?"/g, '"…"').slice(0, 90); counts.set(k, (counts.get(k) ?? 0) + 1); }
[...counts].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, n]) => console.log(n, k));
console.log('\nİlk 15 hata:'); allErr.slice(0, 15).forEach((e) => console.log(e));
