// Bursa Büyükşehir açık veri (Bursa Açık Veri Lisansı) "Çarşı ve Pazar Alanları" listesini şehir rehberi Excel'ine çevirir.
// Önce: veri https://bapi.bursa.bel.tr/apigateway/bbbAcikVeri_Cbs/carsipazar/api/pazar/pazaralanilistesi
//       adresinden veri-denemesi/acikveri/pazar.json olarak indirilir.
// Çalıştırma: npx vite-node scripts/bursa-pazar-acikveri.ts -- <çıktı.xlsx>
import { readFileSync } from 'node:fs';
import writeExcelFile from 'write-excel-file/node';
import { citySection } from '@cityjoy/shared';
import districts from '../packages/shared/data/locations/districts.json';

const out = process.argv[process.argv.length - 1]!;
const SOURCE = 'https://acikyesil.bursa.bel.tr/dataset/carsi-ve-pazar-alanlari';
const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const title = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr').split(/(\s+|-|\.|\/)/).map((w) => w.charAt(0).toLocaleUpperCase('tr') + w.slice(1)).join('');
const bursa = districts.filter((d) => d.provinceCode === '16');
const district = (s: string) => bursa.find((d) => d.name.toLocaleLowerCase('tr') === s.toLocaleLowerCase('tr'))?.name;

// EPSG:2320 (ED50 / TM30: Hayford elipsoidi, orta meridyen 30°, ölçek 1, doğu ötelemesi 500000) -> WGS84.
function ed50tm30ToWgs84(x: number, y: number): [number, number] {
  const a = 6378388, f = 1 / 297, e2 = f * (2 - f), k0 = 1, lon0 = (30 * Math.PI) / 180;
  const ep2 = e2 / (1 - e2), M = y / k0, mu = M / (a * (1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const p1 = mu + ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) + ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) + ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) + ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const C1 = ep2 * Math.cos(p1) ** 2, T1 = Math.tan(p1) ** 2, N1 = a / Math.sqrt(1 - e2 * Math.sin(p1) ** 2);
  const R1 = (a * (1 - e2)) / (1 - e2 * Math.sin(p1) ** 2) ** 1.5, D = (x - 500000) / (N1 * k0);
  const lat = p1 - ((N1 * Math.tan(p1)) / R1) * (D ** 2 / 2 - ((5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * ep2) * D ** 4) / 24 + ((61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * ep2 - 3 * C1 ** 2) * D ** 6) / 720);
  const lon = lon0 + (D - ((1 + 2 * T1 + C1) * D ** 3) / 6 + ((5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * ep2 + 24 * T1 ** 2) * D ** 5) / 120) / Math.cos(p1);
  // Datum kaydırma (ED50 -> WGS84, üç parametre; birkaç metre hassasiyet yeterli).
  const n = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  const X = n * Math.cos(lat) * Math.cos(lon) - 87, Y = n * Math.cos(lat) * Math.sin(lon) - 98, Z = n * (1 - e2) * Math.sin(lat) - 121;
  const A = 6378137, F = 1 / 298.257223563, E2 = F * (2 - F), p = Math.hypot(X, Y);
  let la = Math.atan2(Z, p * (1 - E2));
  for (let i = 0; i < 5; i++) { const Nn = A / Math.sqrt(1 - E2 * Math.sin(la) ** 2); la = Math.atan2(Z + E2 * Nn * Math.sin(la), p); }
  return [(la * 180) / Math.PI, (Math.atan2(Y, X) * 180) / Math.PI];
}

const ALL = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const SHORT: Record<string, string> = { pzt: 'Pazartesi', çrş: 'Çarşamba', prş: 'Perşembe', cmt: 'Cumartesi' };
const days = (s: string | null) => {
  if (!s) return '';
  if (/her ?gün/i.test(s)) return ALL.join(', ');
  return s.split('-').map((d) => { const k = d.trim().toLocaleLowerCase('tr'); return SHORT[k] ?? ALL.find((x) => x.toLocaleLowerCase('tr') === k); }).filter(Boolean).join(', ');
};
const products = (s: string | null) => (s ?? '').toLocaleLowerCase('tr').split('-').map((p) => (/sebze/i.test(p) ? 'Sebze-meyve' : /giy/i.test(p) ? 'Giyim' : '')).filter(Boolean).join(', ');

const list = JSON.parse(readFileSync('veri-denemesi/acikveri/pazar.json', 'utf8')) as any[];
const keys = citySection('pazarlar')!.columns.map((c) => c.key);
const rows: Record<string, string>[] = [];
const seen = new Map<string, number>();
let skipped = 0;
for (const p of list) {
  const ilce = district(p.ilce ?? '');
  if (!ilce || !p.adi?.trim()) { skipped++; continue; }
  const pt = JSON.parse(p.geometry ?? 'null')?.SDO_POINT;
  const [lat, lng] = pt ? ed50tm30ToWgs84(pt.X, pt.Y) : [NaN, NaN];
  const mahalle = p.mahalle ? title(p.mahalle) : '';
  let ad = title(p.adi);
  // Aynı adlı pazar (aynı ilçede) ayırt edilsin: önce günü, o da varsa sıra numarası eklenir.
  const key = (s: string) => `${ilce}|${s.toLocaleLowerCase('tr')}`;
  if (seen.has(key(ad))) { const base = ad; ad = `${base} (${days(p.gunu) || mahalle})`; for (let i = 2; seen.has(key(ad)); i++) ad = `${base} (${i})`; }
  seen.set(key(ad), 1);
  const durum = p.acikMiKapaliMi as string | null;
  const saat = durum && /\d/.test(durum) ? durum.replace('.', ':').replace('.', ':') : '';
  rows.push({
    tur: 'semt-pazari', ad, il: 'Bursa', ilce, mahalle, adres: p.adres ? title(p.adres) : '',
    gunler: days(p.gunu), saatler: saat, kapali_alan: durum === 'KAPALI' ? 'Evet' : durum === 'AÇIK' ? 'Hayır' : '',
    urunler: products(p.turu),
    enlem: Number.isFinite(lat) ? lat.toFixed(6) : '', boylam: Number.isFinite(lng) ? lng.toFixed(6) : '',
    kaynak: SOURCE, kaynak_tarihi: today, not: 'Bursa Büyükşehir Belediyesi açık verisi',
  });
}
await writeExcelFile([{ sheet: citySection('pazarlar')!.sheet, data: [keys, ...rows.map((r) => keys.map((k) => r[k] ?? ''))].map((r) => r.map((value) => ({ value, type: String }))) as any, stickyRowsCount: 1 }]).toFile(out);
console.log(`${rows.length} pazar, ${skipped} atlandı -> ${out}`);
