// Dışarıda (ör. ChatGPT ile) hazırlanan Seyahat Excel'lerini panel kurallarına uydurur:
//   npx vite-node scripts/seyahat-icerik/duzelt.ts -- dosya1.xlsx dosya2.xlsx ...
// Çıktı: Masaüstü/<ad>-duzeltilmis.xlsx. Bölgeler sekmesi bolgeler.ts'teki ortak metinle değiştirilir.
// Düzeltmeler: boş "hakkinda" -> özet; türü yazılmamış "yakındakiler"/"nasıl gidilir" -> anahtar kelimeyle tür,
// bulunamazsa ipuçlarına; "A / B" ilçe -> ilk geçerli ilçe; cep telefonu silinir; bağlantılardaki Google izleme ekleri atılır.
import os from 'node:os';
import path from 'node:path';
import readXlsxFile from 'read-excel-file/node';
import writeExcelFile from 'write-excel-file/node';
import { NEARBY_KINDS, normalizeName, TRAVEL_LIMITS, TRAVEL_MODES, TRAVEL_SHEETS } from '@cityjoy/shared';
import districts from '../../packages/shared/data/locations/districts.json';
import provinces from '../../packages/shared/data/locations/provinces.json';
import { BOLGELER } from './bolgeler';

const key = (s: string) => normalizeName(s);
const MODE_WORDS: [string, string[]][] = [
  ['yuruyus', ['yuru', 'yaya']],
  ['tramvay', ['tramvay']],
  ['metro', ['metro', 'banliyo', 'marmaray']],
  ['teleferik', ['teleferik']],
  ['vapur', ['vapur', 'feribot', 'tekne', 'iskele', 'deniz otobus']],
  ['otobus', ['otobus', 'dolmus', 'minibus', 'toplu tasima']],
  ['taksi', ['taksi']],
  ['araba', ['arac', 'araba', 'otomobil', 'kara yolu', 'karayolu', 'km', 'yol']],
];
const NEAR_WORDS: [string, string[]][] = [
  ['otopark', ['otopark', 'park yeri']],
  ['yemek', ['lokanta', 'restoran', 'kafe', 'cafe', 'yemek', 'cay bahcesi']],
  ['wc', ['wc', 'tuvalet']],
  ['atm', ['atm', 'banka']],
  ['saglik', ['hastane', 'saglik', 'eczane']],
];
const guess = (text: string, table: [string, string[]][]) => {
  const k = ` ${key(text).replace(/-/g, ' ')} `;
  return table.find(([, words]) => words.some((w) => k.includes(w)))?.[0];
};
const split = (v: string) => v.split('|').map((x) => x.trim()).filter(Boolean);
const cleanUrl = (u: string) => u.replace(/([?&])(sa|ved|usg)=[^&\s|]*/g, '$1').replace(/[?&]+(?=\s|\||$)/g, '').replace(/&&+/g, '&').replace(/\?&/g, '?');
const isMobile = (t: string) => /^(\+?90|0)?5\d{9}$/.test(t.replace(/\D/g, '').replace(/^0090/, '0'));

function fixPairs(cell: string, valid: readonly string[], table: [string, string[]][], spill: string[], prefix: string) {
  const out: string[] = [];
  for (const item of split(cell)) {
    const i = item.indexOf(':');
    const head = i > 0 ? key(item.slice(0, i)).replace(/-/g, '') : '';
    if (i > 0 && valid.includes(head)) { out.push(`${head}: ${item.slice(i + 1).trim()}`); continue; }
    const g = guess(i > 0 ? item.slice(0, i) : item, table) ?? guess(item, table);
    if (g) out.push(`${g}: ${(i > 0 && guess(item.slice(0, i), table) ? item.slice(i + 1) : item).trim()}`);
    else spill.push(`${prefix}${item}`);
  }
  return out.slice(0, TRAVEL_LIMITS.listItems).join(' | ');
}

const files = process.argv.slice(2).filter((a) => a !== '--');
const cell = (value: string) => ({ value, type: String });
for (const f of files) {
  const sheets = (await readXlsxFile(f)) as { sheet: string; data: unknown[][] }[];
  const rowsOf = (name: string) => {
    const s = sheets.find((x) => x.sheet === name);
    if (!s) return [];
    const h = s.data[0]!.map((c) => String(c ?? '').trim());
    return s.data.slice(1).map((r) => Object.fromEntries(h.map((c, i) => [c, String(r[i] ?? '').trim()])) as Record<string, string>);
  };
  const notes: Record<string, number> = {};
  const note = (k: string) => (notes[k] = (notes[k] ?? 0) + 1);

  const cities = rowsOf(TRAVEL_SHEETS.sehir.sheet);
  const places = rowsOf(TRAVEL_SHEETS.yer.sheet).map((r) => {
    const p = provinces.find((x) => key(x.name) === key(r.il));
    if (r.ilce && p && !districts.some((d) => d.provinceCode === p.code && key(d.name) === key(r.ilce))) {
      const hit = r.ilce.split(/[\/,]/).map((x) => x.trim()).find((x) => districts.some((d) => d.provinceCode === p.code && key(d.name) === key(x)));
      r.ilce = hit ?? '';
      note('ilçe düzeltildi');
    }
    if ((r.hakkinda ?? '').length < 10 && (r.ozet ?? '').length >= 10) { r.hakkinda = r.ozet; note('hakkında özetten'); }
    const spill: string[] = [];
    if (r.nasil_gidilir) r.nasil_gidilir = fixPairs(r.nasil_gidilir, TRAVEL_MODES, MODE_WORDS, spill, 'Ulaşım: ');
    if (r.yakindakiler) r.yakindakiler = fixPairs(r.yakindakiler, NEARBY_KINDS, NEAR_WORDS, spill, 'Yakında: ');
    if (spill.length) { r.ipuclari = [...split(r.ipuclari ?? ''), ...spill].slice(0, TRAVEL_LIMITS.listItems).join(' | '); note('ipuçlarına taşındı'); }
    for (const c of ['ipuclari', 'ziyaret_saatleri', 'giris_ucreti', 'nasil_gidilir', 'yakindakiler']) {
      if (r[c]) r[c] = split(r[c]).map((x) => (x.length > TRAVEL_LIMITS.shortText ? x.slice(0, TRAVEL_LIMITS.shortText - 1) + '…' : x)).join(' | ');
    }
    if (r.telefon && isMobile(r.telefon)) { r.telefon = ''; note('cep telefonu silindi'); }
    for (const c of ['web', 'kaynak', 'video']) if (r[c]) r[c] = cleanUrl(r[c]);
    return r;
  });

  const sheet = (d: { sheet: string; columns: readonly string[] }, rows: Record<string, string>[]) => ({
    sheet: d.sheet,
    data: [d.columns.map(cell), ...rows.map((r) => d.columns.map((c) => cell(r[c] ?? '')))] as any,
    stickyRowsCount: 1,
  });
  const base = path.basename(f).replace(/^[0-9a-f]{8}-/, '').replace(/\.xlsx$/, '');
  const out = path.join(os.homedir(), 'Desktop', `${base}-duzeltilmis.xlsx`);
  await writeExcelFile([sheet(TRAVEL_SHEETS.bolge, BOLGELER), sheet(TRAVEL_SHEETS.sehir, cities), sheet(TRAVEL_SHEETS.yer, places)]).toFile(out);
  console.log(base, `şehir ${cities.length}, yer ${places.length}`, notes, '->', out);
}
