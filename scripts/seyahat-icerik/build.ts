// Seyahat içerik dosyalarından panele yüklenecek Excel'i üretir:
//   npx vite-node scripts/seyahat-icerik/build.ts -- marmara  (çıktı: Masaüstü/CityJoy-Seyahat-<bolge>-panel.xlsx)
import os from 'node:os';
import path from 'node:path';
import writeExcelFile from 'write-excel-file/node';
import { TRAVEL_SHEETS } from '@cityjoy/shared';
import { BOLGELER } from './bolgeler';
import * as marmara from './marmara';

const BOLGE_DOSYALARI = { marmara } as Record<string, { SEHIRLER: Record<string, string>[]; YERLER: Record<string, string>[] }>;

const bolge = process.argv.slice(2).filter((a) => a !== '--')[0] ?? 'marmara';
const mod = BOLGE_DOSYALARI[bolge];
if (!mod) throw new Error('Bilinmeyen bölge: ' + bolge);

const cell = (value: string) => ({ value, type: String });
const sheet = (d: { sheet: string; columns: readonly string[] }, rows: Record<string, string>[]) => ({
  sheet: d.sheet,
  data: [d.columns.map(cell), ...rows.map((r) => d.columns.map((c) => cell(r[c] ?? '')))] as any,
  stickyRowsCount: 1,
});

const out = path.join(os.homedir(), 'Desktop', `CityJoy-Seyahat-${bolge}-panel.xlsx`);
await writeExcelFile([
  sheet(TRAVEL_SHEETS.bolge, BOLGELER),
  sheet(TRAVEL_SHEETS.sehir, mod.SEHIRLER),
  sheet(TRAVEL_SHEETS.yer, mod.YERLER),
]).toFile(out);
console.log(`bölge ${BOLGELER.length}, şehir ${mod.SEHIRLER.length}, yer ${mod.YERLER.length} ->`, out);
