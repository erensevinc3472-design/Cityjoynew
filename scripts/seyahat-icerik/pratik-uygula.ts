// Birleşik Seyahat Excel'ine pratik bilgileri (pratik.ts) işler, yeni dosya yazar. Bursa satırları çıkarılır: Bursa
// yerleri yayında ve kendi pratik bilgileri var; Excel'le yeniden yüklenirse onların üstüne yazılırdı.
//   npx vite-node scripts/seyahat-icerik/pratik-uygula.ts -- giris.xlsx cikis.xlsx
import readXlsxFile from 'read-excel-file/node';
import writeExcelFile from 'write-excel-file/node';
import { normalizeName, TRAVEL_LIMITS, TRAVEL_SHEETS } from '@cityjoy/shared';
import { BAKANLIK_IPUCU, DEPREM_ILLER, DEPREM_IPUCU, groupOf, OZEL } from './pratik';

const [inp, out] = process.argv.slice(2).filter((a) => a !== '--') as [string, string];
const sheets = (await readXlsxFile(inp)) as { sheet: string; data: unknown[][] }[];
const rows = (name: string) => {
  const s = sheets.find((x) => x.sheet === name)!;
  const h = s.data[0]!.map(String);
  return s.data.slice(1).map((r) => Object.fromEntries(h.map((c, i) => [c, String(r[i] ?? '')])) as Record<string, string>);
};
const L = TRAVEL_LIMITS.listItems;
const split = (s: string) => s.split('|').map((x) => x.trim()).filter(Boolean);
const used = new Set<string>();
const places = rows(TRAVEL_SHEETS.yer.sheet).filter((r) => normalizeName(r.il!) !== normalizeName('Bursa'));
for (const r of places) {
  const key = `${r.il}|${r.ad}`;
  const o = OZEL[key] ?? {};
  if (OZEL[key]) used.add(key);
  const g = groupOf(r.tur!, r.ad!);
  r.ziyaret_saatleri ||= o.saat ?? g.saat ?? '';
  r.giris_ucreti ||= o.ucret ?? g.ucret ?? '';
  r.onerilen_sure = o.sure ?? (r.onerilen_sure || g.sure || '');
  if (!r.yakindakiler) r.yakindakiler = (o.yakin ?? g.yakin ?? []).join(' | ');
  r.erisilebilirlik ||= o.erisim ?? g.erisim ?? '';
  r.yas_bilgisi = o.yas ?? g.yas ?? '';
  r.yanina_al = (o.bring ?? g.bring ?? []).join(' | ');
  r.kurallar = (o.rules ?? g.rules ?? []).join(' | ');
  const old = split(r.ipuclari ?? '');
  const tips = [...old, ...(o.tips ?? []), ...(old.length ? [] : g.tips ?? [])];
  if (/müze ?kart|t\.c\. vatandaş/i.test(r.giris_ucreti)) tips.push(BAKANLIK_IPUCU);
  if (DEPREM_ILLER.includes(r.il!)) tips.unshift(DEPREM_IPUCU);
  r.ipuclari = [...new Set(tips)].slice(0, L).join(' | ');
}
const cell = (value: string) => ({ value, type: String });
const sheet = (d: { sheet: string; columns: readonly string[] }, rs: Record<string, string>[]) => ({
  sheet: d.sheet, data: [d.columns.map(cell), ...rs.map((r) => d.columns.map((c) => cell(r[c] ?? '')))] as any, stickyRowsCount: 1,
});
await writeExcelFile([sheet(TRAVEL_SHEETS.bolge, rows(TRAVEL_SHEETS.bolge.sheet)), sheet(TRAVEL_SHEETS.sehir, rows(TRAVEL_SHEETS.sehir.sheet)), sheet(TRAVEL_SHEETS.yer, places)]).toFile(out);
console.log(`${places.length} yer işlendi, özel not ${used.size}/${Object.keys(OZEL).length}`);
console.log('eşleşmeyen özel not:', Object.keys(OZEL).filter((k) => !used.has(k)));
