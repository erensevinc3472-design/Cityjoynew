// Seyahat Excel şablonunu üretir (Panel > Seyahat > Excel şablonu): npx vite-node scripts/seyahat-sablon.ts
// Ayrıca: npx vite-node scripts/seyahat-sablon.ts -- --check dosya.xlsx  (dosyayı panel kurallarıyla denetler)
import readXlsxFile from 'read-excel-file/node';
import writeExcelFile from 'write-excel-file/node';
import { parseTravelWorkbook, TRAVEL_SHEET_HELP, TRAVEL_SHEETS } from '@cityjoy/shared';
import districts from '../packages/shared/data/locations/districts.json';
import provinces from '../packages/shared/data/locations/provinces.json';

const args = process.argv.slice(2).filter((a) => a !== '--');
if (args[0] === '--check') {
  const sheets = (await readXlsxFile(args[1]!)) as { sheet: string; data: unknown[][] }[];
  const r = parseTravelWorkbook(sheets, { provinces, districts } as any);
  console.log(`bölge ${r.regions.length}, şehir ${r.cities.length}, yer ${r.places.length}, hata ${r.errors.length}`);
  r.errors.slice(0, 30).forEach((e) => console.log(`${e.sheet} ${e.row}: ${e.message}`));
  process.exit(r.errors.length ? 1 : 0);
}

const cell = (value: string) => ({ value, type: String });
const okuyun = [
  ['CityJoy Seyahat > Keşfet ve Öğren şablonu'],
  ['Her sekmenin ilk satırı sütun adlarıdır, değiştirmeyin. Liste hücrelerinde öğeleri " | " ile ayırın.'],
  ['Metinleri kendi cümlelerinizle yazın; başka sitelerden metin ve fotoğraf kopyalamayın. Saat, ücret ve telefon yalnızca resmî kaynakta yazıyorsa girilir.'],
  ['Yüklenen kayıtlar taslak olarak girer; panelde kontrol edip yayına alın. Aynı il + ad yeniden yüklenirse güncellenir.'],
  [''],
  ['Sütun', 'Açıklama'],
  ...Object.entries(TRAVEL_SHEET_HELP),
];
const out = 'apps/panel/public/seyahat-sablon.xlsx';
await writeExcelFile([
  { sheet: 'Okuyun', data: okuyun.map((r) => r.map(cell)) as any, columns: [{ width: 22 }, { width: 110 }] },
  ...Object.values(TRAVEL_SHEETS).map((d) => ({ sheet: d.sheet, data: [d.columns.map(cell)] as any, stickyRowsCount: 1 })),
]).toFile(out);
console.log('şablon ->', out);
