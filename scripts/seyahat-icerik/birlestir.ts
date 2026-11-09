// Bölge Excel'lerini tek dosyada birleştirir (Bölgeler sekmesi ilk dosyadan):
//   npx vite-node scripts/seyahat-icerik/birlestir.ts -- cikti.xlsx a.xlsx b.xlsx ...
import readXlsxFile from 'read-excel-file/node';
import writeExcelFile from 'write-excel-file/node';
import { TRAVEL_SHEETS } from '@cityjoy/shared';

const [out, ...files] = process.argv.slice(2).filter((a) => a !== '--');
const defs = Object.values(TRAVEL_SHEETS);
const rows: Record<string, unknown[][]> = Object.fromEntries(defs.map((d) => [d.sheet, []]));
for (const [i, f] of files.entries()) {
  for (const s of (await readXlsxFile(f!)) as { sheet: string; data: unknown[][] }[]) {
    const d = defs.find((x) => x.sheet === s.sheet);
    if (!d || (d === TRAVEL_SHEETS.bolge && i > 0)) continue;
    const h = s.data[0]!.map(String);
    rows[d.sheet]!.push(...s.data.slice(1).map((r) => d.columns.map((c) => r[h.indexOf(c)] ?? '')));
  }
}
const cell = (v: unknown) => ({ value: String(v ?? ''), type: String });
await writeExcelFile(defs.map((d) => ({ sheet: d.sheet, data: [d.columns.map(cell), ...rows[d.sheet]!.map((r) => r.map(cell))] as any, stickyRowsCount: 1 }))).toFile(out!);
console.log(defs.map((d) => `${d.sheet} ${rows[d.sheet]!.length}`).join(', '), '->', out);
