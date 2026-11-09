// Bursa ek kurumlar ve belediye hizmetleri: Eren'in "CityJoy-Bursa-Eksik-Veriler.xlsx" dosyası ile
// kaymakamlık sitelerinden okunan resmî birim bilgilerini (scripts/bursa-kaymakamlik-birimler.ts) birleştirir.
// Aynı birim için resmî kayıt öne geçer; Eren'in ikincil kaynaklı satırları "not" sütununda teyit notuyla kalır.
// Çalıştırma: npx vite-node scripts/bursa-kurumlar-ek.ts -- <Eksik-Veriler.xlsx> <çıktı.xlsx>
import { readFileSync } from 'node:fs';
import readXlsxFile from 'read-excel-file/node';
import writeExcelFile from 'write-excel-file/node';
import { citySection } from '@cityjoy/shared';
import districts from '../packages/shared/data/locations/districts.json';

const [src, out] = process.argv.slice(-2) as [string, string];
const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const bursa = districts.filter((d) => d.provinceCode === '16').map((d) => d.name);
const low = (s: string) => s.toLocaleLowerCase('tr');
const ilceOf = (s: string) => {
  let best = '', at = -1;
  for (const d of bursa) { const i = low(s).lastIndexOf(low(d)); if (i > at) { at = i; best = d; } }
  return best;
};
const mahalleOf = (s: string) => (s.replace(/^(Hükümet Konağı|Adalet Sarayı)[,\s]+/i, '').match(/^(.+?)\s+(Mah\.|Mh\.|Mah\b|Mahallesi)/i)?.[1]?.trim() ?? '').replace(/\.$/, '');
const tel = (s: string) => {
  for (const part of String(s ?? '').split(/\s-\s|Fax|Faks|\/(?=\s*\(?0)/i)) {
    let d = part.replace(/\D/g, '');
    if (d.length === 10) d = '0' + d;
    if (d.length === 12 && d.startsWith('90')) d = '0' + d.slice(2);
    if (d.length === 11 && !d.startsWith('05')) return d;
  }
  return '';
};
/** Büyük harfle yazılmış metni "Başlık Biçimi"ne çevirir. */
const title = (s: string) => {
  const letters = s.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, '');
  if (!letters || letters.replace(/[^a-zçğıöşü]/g, '').length / letters.length > 0.3) return s;
  return s.toLocaleLowerCase('tr').replace(/(^|[\s(/.-])([a-zçğıöşü])/g, (_, a, b) => a + b.toLocaleUpperCase('tr'));
};
/** Adres sonundaki "16860 İznik/Bursa" gibi kısımları ve yazım hatalarını temizler. */
const adresTemiz = (s: string) => title(String(s ?? '').trim())
  .replace(/^Türkiye Cumhuriyeti .*?Kaymakamlığı\s+/i, '')
  .replace(/\bMahç\s/, 'Mah. ').replace(/No:,\s*/g, '')
  .replace(/,?\s*\b\d{5}\b/g, '')
  .replace(/[\s,]*[A-Za-zÇĞİÖŞÜçğıöşü]+\s*\/\s*Bursa\b\.?/gi, '')
  .replace(/[\s,-]+(Bursa)$/i, '').replace(/\s*PK:\s*$/i, '')
  .replace(new RegExp(`[\\s,]+(${bursa.join('|')})$`, 'i'), '')
  .replace(/\s+/g, ' ').replace(/[\s,-]+$/, '').trim();
const inBursa = (lat: number, lng: number) => lat > 39.5 && lat < 40.8 && lng > 28 && lng < 30.2;

type Row = Record<string, string>;

// 1) Resmî kaymakamlık/valilik birimleri.
const resmi = JSON.parse(readFileSync('veri-denemesi/acikveri/kaymakamlik-birimler.json', 'utf8')) as { s: string; u: string; baslik: string; adres: string; tel: string; lat: string; lng: string }[];
const slugIlce: Record<string, string> = {};
const host = (ilce: string) => low(ilce).replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u');
for (const d of bursa) slugIlce[host(d)] = d;
const kategoriOf = (s: string) =>
  /jandarma/i.test(s) ? 'jandarma' : /nüfus|nufus/i.test(s) ? 'nufus-mudurlugu' : /göç|goc/i.test(s) ? 'goc-idaresi'
  : /mal ?müd|malmüd|vergi/i.test(s) ? 'vergi-dairesi' : /tapu/i.test(s) ? 'tapu' : '';
const ACIKLAMA: Record<string, string> = {
  'jandarma': 'Acil durumda 156 (Jandarma) ya da 112 aranır.',
  'nufus-mudurlugu': 'Kimlik kartı, pasaport ve ehliyet işlemleri. Randevu: randevu.nvi.gov.tr',
  'goc-idaresi': 'Yabancılar için ikamet izni ve göç işlemleri. Randevu: e-ikamet.goc.gov.tr',
  'vergi-dairesi': 'Vergi ödemeleri ve mal müdürlüğü işlemleri.',
  'tapu': 'Tapu ve kadastro işlemleri (alım-satım, ipotek). Randevu: webtapu.tkgm.gov.tr',
};
const resmiRows: Row[] = [];
for (const r of resmi) {
  if (!r.baslik) continue;
  const k = kategoriOf(r.baslik + ' ' + r.u);
  if (!k) continue;
  const isIl = r.s === 'bursa';
  const adres = adresTemiz(r.adres);
  let ilce = isIl ? (ilceOf(r.adres) || 'Osmangazi') : slugIlce[r.s]!;
  let ad = title(r.baslik).replace(/NüfusMüdürlüğü/, 'Nüfus Müdürlüğü').replace(/\s+/g, ' ').replace('İnegöl İlçe Nüfus Müdürlüğü', 'İnegöl İlçe Nüfus Müdürlüğü');
  if (isIl) ad = 'Bursa ' + ad;
  else if (!low(ad).includes(low(ilce))) ad = `${ilce} ${ad.replace(/^Tapu İlçe Müdürlüğü$/, 'İlçe Tapu Müdürlüğü')}`;
  const lat = Number(r.lat), lng = Number(r.lng);
  const yer = ilceOf(r.adres);
  const aciklama = [ACIKLAMA[k], yer && yer !== ilce && !isIl ? `Hizmet binası ${yer} ilçesindedir.` : ''].filter(Boolean).join(' ');
  resmiRows.push({
    kategori: k === 'tapu' ? 'diger' : k, ad, ilce, adres, telefon: tel(r.tel), web: `https://www.${r.s}.gov.tr`,
    calisma_hafta_ici: k === 'jandarma' ? '' : '08:30-17:30', aciklama,
    enlem: inBursa(lat, lng) ? lat.toFixed(6) : '', boylam: inBursa(lat, lng) ? lng.toFixed(6) : '', kaynak: r.u,
    ...(yer && yer !== ilce && !isIl ? { mahalle: '' } : {}), // bina başka ilçedeyse mahalle o ilçeye ait, yazılmaz
  });
}
// Harmancık İlçe Jandarma: sitedeki birim sayfasında konum bloğu yok, bilgi sayfa metninden.
resmiRows.push({ kategori: 'jandarma', ad: 'Harmancık İlçe Jandarma Komutanlığı', ilce: 'Harmancık', adres: 'Merkez Mah. 4 Eylül Cad. No:82', telefon: '02248812002', web: 'https://www.harmancik.gov.tr', calisma_hafta_ici: '', aciklama: ACIKLAMA.jandarma!, enlem: '', boylam: '', kaynak: 'https://www.harmancik.gov.tr' });

// 2) Eren'in Kurumlar sayfası.
const sheets = (await readXlsxFile(src)) as { sheet: string; data: any[][] }[];
const KAT: Record<string, string> = { 'Nüfus': 'nufus-mudurlugu', 'SGK': 'sgk', 'Jandarma': 'jandarma', 'Vergi': 'vergi-dairesi', 'PTT': 'ptt', 'Noter': 'noter' };
const erenRows: Row[] = [];
for (const r of sheets.find((s) => s.sheet === 'Kurumlar')!.data.slice(1)) {
  const [kat, ad, ilce, adres, telefon, kaynak, , notu] = r.map((c) => (c == null ? '' : String(c).trim()));
  if (!ad) continue;
  const kategori = kat === 'İl müdürlüğü' ? (/Göç/i.test(ad!) ? 'goc-idaresi' : 'il-mudurlugu') : KAT[kat!] ?? 'diger';
  const resmiMi = /^Resmî kaynak$/i.test(notu!);
  erenRows.push({
    kategori, ad: ad!.replace(/\s+/g, ' '), ilce: ilce!, adres: adresTemiz(adres!), telefon: tel(telefon!),
    calisma_hafta_ici: ['noter', 'ptt', 'jandarma'].includes(kategori) ? '' : '08:30-17:30',
    aciklama: ACIKLAMA[kategori] ?? '', kaynak: kaynak!, not: resmiMi ? '' : notu!.replace(/\s*·\s*/g, '; '),
  });
}

// 3) Birleştir: aynı birimde resmî kayıt öne geçer, boş alanları Eren'in satırından tamamlanır.
const tek = new Set(['jandarma', 'nufus-mudurlugu', 'goc-idaresi']);
const norm = (s: string) => low(s).replace(/ilçe|mal müdürlüğü/g, (m) => (m === 'ilçe' ? '' : 'malmüdürlüğü')).replace(/[^a-zçğıöşü0-9]/g, '');
const key = (r: Row) => tek.has(r.kategori!) ? `${r.kategori}|${r.ilce}|${/^Bursa İl\b/.test(r.ad!) ? 'il' : 'ilce'}` : `${r.kategori}|${r.ilce}|${norm(r.ad!)}`;
const byKey = new Map<string, Row>();
for (const r of resmiRows) if (!byKey.has(key(r))) byKey.set(key(r), r);
let degisen = 0;
for (const e of erenRows) {
  const r = byKey.get(key(e));
  if (!r) { byKey.set(key(e), e); continue; }
  if (e.telefon && r.telefon && e.telefon !== r.telefon) { degisen++; console.log(`telefon düzeltildi: ${r.ad}  ${e.telefon} -> ${r.telefon}`); }
  if (!r.telefon && e.telefon) { r.telefon = e.telefon; r.not = 'Telefon ikincil rehberden; teyit önerilir'; }
  if (!r.adres && e.adres) r.adres = e.adres;
}
const rows = [...byKey.values()].map((r) => ({ il: 'Bursa', kaynak_tarihi: today, mahalle: mahalleOf(r.adres ?? ''), ...r }));
rows.sort((a, b) => (a.kategori! + a.ilce + a.ad).localeCompare(b.kategori! + b.ilce + b.ad, 'tr'));

// 4) Belediye hizmetleri (Eren'in sayfası + e-Devlet belediye sayfaları doğrulanmış ilçeler).
const BEL: Record<string, string> = { 'BUSKİ': 'Bursa Büyükşehir Belediyesi', 'BURPARK': 'Bursa Büyükşehir Belediyesi' };
const hiz: Row[] = [];
for (const r of sheets.find((s) => s.sheet === 'Belediye hizmetleri')!.data.slice(1)) {
  const [kurum, hizmet, durum, telefon, kaynak] = r.map((c) => (c == null || c === 'null' ? '' : String(c).trim()));
  if (!kurum || /doğrulanamadı/i.test(durum!) && !telefon) continue; // bilgi içermeyen satır alınmaz
  const belediye = BEL[kurum] ?? `${kurum} Belediyesi`;
  const h = low(hizmet!);
  const kategori = kurum === 'BUSKİ' ? 'su-altyapi' : /sosyal/.test(h) ? 'sosyal-yardim' : /kurs/.test(h) ? 'egitim-kurs' : /e-belediye/.test(h) ? 'vergi-odeme' : 'diger';
  let hizmet_adi = hizmet!, aciklama = durum!, gerekli_evrak = '', not = '';
  if (kurum === 'BUSKİ') {
    hizmet_adi = `Su aboneliği: ${low(hizmet!)}`;
    const m = durum!.match(/^(.*?)(Kimlik.*?)(\.\s*(Keşif.*))?$/);
    if (m && /Kimlik/.test(durum!)) { aciklama = (m[1]!.trim() || 'BUSKİ şubesine başvurulur.') + (m[4] ? ' ' + m[4] : ''); gerekli_evrak = m[2]!.replace(/\.$/, '').split(/,\s*/).map((x) => x.charAt(0).toLocaleUpperCase('tr') + x.slice(1)).join(', '); }
    if (/^BUSKİ şubesi/.test(aciklama)) aciklama = 'Başvuru BUSKİ şubesi, e-BUSKİ, e-Devlet ya da BUSKİ Mobil ile yapılır.';
    if (/Online devir/i.test(hizmet!)) { hizmet_adi = 'Su aboneliği: e-Devlet\'ten devir başvurusu'; aciklama = 'Abonelik devri ve isim değişikliği e-Devlet\'ten başvurulur ve takip edilir.'; }
    if (/Teminat/i.test(hizmet!)) { hizmet_adi = 'Su aboneliği teminat ücretleri'; aciklama = 'Abonelik türüne göre alınan teminat tutarları BUSKİ\'nin güncel tarife sayfasında yayımlanır.'; }
  }
  if (kurum === 'BURPARK') { hizmet_adi = 'BURPARK aylık otopark aboneliği'; aciklama = 'Aylık abonelik ücreti ve başvuru koşulları için otopark adı ve plakayla BURPARK danışma hattı aranır.'; not = 'Tarife resmî sayfada yayımlanmıyor; teyit önerilir'; }
  if (/^e-belediye$/i.test(hizmet!)) { hizmet_adi = 'E-belediye: vergi ve borç ödeme'; aciklama = 'Emlak vergisi ve diğer belediye borçları internetten sorgulanır ve ödenir.'; }
  if (/^nikâh$/i.test(hizmet!)) { hizmet_adi = 'Evlenme başvurusu (nikâh)'; aciklama = 'Evlendirme Memurluğu başvuruları, gerekli belgeler ve nikâh günleri hakkında bilgi.'; }
  if (/^kurs$/i.test(hizmet!)) { hizmet_adi = 'Belediye kursları'; aciklama = (durum!.replace(/Duyuru.*$|Dönem tarihlerini.*$/, '').trim() || 'Belediyenin kültür, sanat ve meslek kursları.') + ' Dönem tarihleri kaynak sayfada.'; }
  if (/^sosyal yardım$/i.test(hizmet!)) { hizmet_adi = 'Sosyal yardım başvurusu'; aciklama = /Halk Market/.test(durum!) ? 'İhtiyaç sahipleri Halk Market desteği için Sosyal Yardım İşleri Müdürlüğüne başvurur.' : 'İhtiyaç sahipleri için sosyal yardım başvurusu.'; }
  hiz.push({ il: 'Bursa', belediye, kategori, hizmet_adi, aciklama, gerekli_evrak, basvuru_baglantisi: kaynak!, telefon: tel(telefon!), kaynak: kaynak!, kaynak_tarihi: today, not });
}
// Eren'in listesinde olmayan ilçe belediyeleri: e-Devlet ve e-belediye sayfaları (açık olduğu denetlendi).
const EDEVLET: [string, string][] = [
  ['Büyükorhan', 'https://www.turkiye.gov.tr/buyukorhan-belediyesi'], ['Harmancık', 'https://www.turkiye.gov.tr/harmancik-belediyesi'],
  ['İznik', 'https://www.turkiye.gov.tr/iznik-belediyesi'], ['Keles', 'https://www.turkiye.gov.tr/keles-belediyesi'],
  ['Mustafakemalpaşa', 'https://www.turkiye.gov.tr/mustafakemalpasa-belediyesi'], ['Orhangazi', 'https://www.turkiye.gov.tr/orhangazi-belediyesi'],
  ['Karacabey', 'https://ebelediye.karacabey.bel.tr/'], ['Orhaneli', 'https://ebelediye.orhaneli.bel.tr/'], ['Yenişehir', 'https://ebelediye.yenisehir.bel.tr/'],
];
for (const [ilce, url] of EDEVLET) {
  const edv = url.includes('turkiye.gov.tr');
  hiz.push({ il: 'Bursa', belediye: `${ilce} Belediyesi`, kategori: 'vergi-odeme', hizmet_adi: edv ? 'E-Devlet: belediye borcu ve hizmetleri' : 'E-belediye: vergi ve borç ödeme',
    aciklama: edv ? 'Emlak vergisi ve diğer belediye borçları e-Devlet\'te belediyenin sayfasından sorgulanır ve ödenir.' : 'Emlak vergisi ve diğer belediye borçları internetten sorgulanır ve ödenir.',
    basvuru_baglantisi: url, kaynak: url, kaynak_tarihi: today });
}

// 5) Nasıl yapılır: su aboneliği.
const BUSKI = 'https://www.buski.gov.tr/abone-hizmetleri/detay/1/abone-islemleri/1/';
const nasil: Row[] = [{
  il: 'Bursa', kategori: 'resmi-islem', baslik: 'Su aboneliği açma ya da devralma (BUSKİ)',
  kisa_metin: 'Taşındığınız evde suyu kendi adınıza almak için BUSKİ aboneliği devralınır. Başvuru internetten ya da şubeden yapılır.',
  adimlar: 'Tapu ya da kira sözleşmenizi, DASK poliçe numaranızı ve eski abone numarasını hazırlayın | e-Devlet, e-BUSKİ, BUSKİ Mobil ya da bir BUSKİ şubesinden devir başvurusu yapın | Teminat tutarını ödeyin | Sözleşme imzalanınca abonelik adınıza geçer',
  gerekli_belgeler: 'Kimlik, Tapu ya da kira sözleşmesi, DASK poliçe numarası, Abone numarası',
  ilgili_baglanti: BUSKI, kaynak: BUSKI, kaynak_tarihi: today, not: 'BUSKİ çağrı merkezi 0224 270 24 00',
}];

const sheet = (id: string, list: Row[]) => {
  const s = citySection(id)!;
  const keys = s.columns.map((c) => c.key);
  return { sheet: s.sheet, data: [keys, ...list.map((r) => keys.map((k) => r[k] ?? ''))].map((r) => r.map((value) => ({ value, type: String }))) as any, stickyRowsCount: 1 };
};
await writeExcelFile([sheet('onemli-kurumlar', rows), sheet('belediye-hizmetleri', hiz), sheet('nasil-yapilir', nasil)] as any).toFile(out);
const by = new Map<string, number>();
rows.forEach((r) => by.set(r.kategori!, (by.get(r.kategori!) ?? 0) + 1));
console.log(`${rows.length} kurum (${resmiRows.length} resmî kayıt, ${degisen} telefon düzeltmesi), ${hiz.length} belediye hizmeti, ${nasil.length} nasıl yapılır -> ${out}`, Object.fromEntries(by));
const jan = new Set(rows.filter((r) => r.kategori === 'jandarma').map((r) => r.ilce));
console.log('jandarması eksik ilçeler:', bursa.filter((d) => !jan.has(d)).join(', '));
