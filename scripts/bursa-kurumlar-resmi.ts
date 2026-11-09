// Bursa "Önemli Kurumlar" sekmesini resmî sitelerden derler: valilik, kaymakamlıklar, emniyet, adliye,
// itfaiye istasyonları, il/ilçe halk kütüphaneleri, halk eğitim merkezleri.
// Önce: veri-denemesi/acikveri/emniyet.json (bursa.pol.tr ilçe sayfalarından) ve kutuphaneler.json (BBB açık veri).
// İtfaiye ve Kültür Turizm kütüphane listeleri çalışırken resmî sayfalardan okunur.
// Çalıştırma: npx vite-node scripts/bursa-kurumlar-resmi.ts -- <çıktı.xlsx>
import { readFileSync } from 'node:fs';
import writeExcelFile from 'write-excel-file/node';
import { citySection } from '@cityjoy/shared';
import districts from '../packages/shared/data/locations/districts.json';

const out = process.argv[process.argv.length - 1]!;
const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const bursa = districts.filter((d) => d.provinceCode === '16').map((d) => d.name);
const low = (s: string) => s.toLocaleLowerCase('tr');
/** Adreste geçen son ilçe adı ("... Kumla-Gemlik / BURSA" -> Gemlik). */
const ilceOf = (s: string) => {
  let best = '', at = -1;
  for (const d of bursa) { const i = low(s).lastIndexOf(low(d)); if (i > at) { at = i; best = d; } }
  return best;
};
const mahalleOf = (s: string) => (s.match(/^(.+?)\s+(Mah\.|Mh\.|Mah\b|Mahallesi)/i)?.[1]?.trim() ?? '').replace(/\.$/, '');
/** Sabit hat (0 ile 11 hane). 05xx cep numaraları alınmaz. */
const tel = (s: string) => {
  for (const part of s.split(/\s-\s|Fax|Faks|\/(?=\s*\(?0)/i)) {
    let d = part.replace(/\D/g, '');
    if (d.length === 10) d = '0' + d;
    if (d.length === 12 && d.startsWith('90')) d = '0' + d.slice(2);
    if (d.length === 11 && !d.startsWith('05')) return d;
  }
  return '';
};
const lines = async (url: string) => {
  const t = await (await fetch(url)).text();
  return t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').split('\n').map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
};

type Row = Record<string, string>;
const rows: Row[] = [];
const add = (r: Row) => rows.push({ il: 'Bursa', kaynak_tarihi: today, mahalle: r.mahalle ?? mahalleOf(r.adres ?? ''), ...r });

// 1) Valilik ve kaymakamlıklar (her birinin kendi /iletisim sayfası).
const gov: [string, string, string, string, string?][] = [
  ['Bursa Valiliği', 'Osmangazi', 'Hocaalizade Mah. 6. Kültür Sok. No:2 Heykel', '02242251900', 'https://www.bursa.gov.tr/iletisim'],
  ['Gemlik Kaymakamlığı', 'Gemlik', 'Demirsubaşı Mah. İskele Cad. Kumsal Sk. No:11', '02245131051'],
  ['Gürsu Kaymakamlığı', 'Gürsu', 'İstiklal Mah. Cami Sok. No:3/2', '02243717171', 'https://www.gursu.gov.tr/'],
  ['Harmancık Kaymakamlığı', 'Harmancık', 'Merkez Mah. 4 Eylül Cad. Hükümet Konağı 2. Kat', '02248812450', 'https://www.harmancik.gov.tr/'],
  ['İnegöl Kaymakamlığı', 'İnegöl', 'Süleymaniye Mah. İstiklal Cad. No:200', '02247151001'],
  ['İznik Kaymakamlığı', 'İznik', 'Kılıçarslan Cad. Eski Tekel Binası', '02247571001'],
  ['Karacabey Kaymakamlığı', 'Karacabey', 'Drama Mah. Cumhuriyet Meydanı No:5', '02246761095'],
  ['Keles Kaymakamlığı', 'Keles', 'Cuma Mah. Atatürk Cad. Hükümet Konağı Kat:3', '02248612005'],
  ['Kestel Kaymakamlığı', 'Kestel', 'Vani Mehmet Mah. Pazaryeri Sk. No:9', '02243724656'],
  ['Mudanya Kaymakamlığı', 'Mudanya', 'Mütareke Mah. 12 Eylül Cad. No:29/2', '02245441001'],
  ['Mustafakemalpaşa Kaymakamlığı', 'Mustafakemalpaşa', 'Züferbey Mah. Cumhurluk Alanı No:1 Hükümet Konağı Kat:3', '02246131010'],
  ['Nilüfer Kaymakamlığı', 'Nilüfer', 'İhsaniye Mah. Nilüfer Cumhuriyet Meydanı No:7A', '02242493200'],
  ['Orhaneli Kaymakamlığı', 'Orhaneli', 'İsmetpaşa Mah. Hastane Sok. No:12 Hükümet Konağı', '02248171010'],
  ['Osmangazi Kaymakamlığı', 'Osmangazi', 'Yahşibey Mah. Altıparmak Cad. No:63 Hükümet Konağı Kat:3', '02242240079'],
  ['Orhangazi Kaymakamlığı', 'Orhangazi', 'Camikebir Mah. Tozkoparan Cad. No:63 Hükümet Konağı', '02245731727'],
  ['Yenişehir Kaymakamlığı', 'Yenişehir', 'Ulucami Mah. Cumhuriyet Cad. No:57', '02247730012'],
  ['Yıldırım Kaymakamlığı', 'Yıldırım', 'Şükraniye Mah. 7. Mercan Sk. No:3', '02243641899'],
  ['Büyükorhan Kaymakamlığı', 'Büyükorhan', 'Orhan Mah. Dr. İbrahim Öktem Cad. No:38 Hükümet Konağı Kat:3', '02248412001'],
];
const host = (ilce: string) => low(ilce).replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u');
for (const [ad, ilce, adres, telefon, src] of gov) {
  const web = ad.startsWith('Bursa') ? 'https://www.bursa.gov.tr' : `https://www.${host(ilce)}.gov.tr`;
  add({ kategori: ad.startsWith('Bursa') ? 'valilik' : 'kaymakamlik', ad, ilce, adres, telefon, web, calisma_hafta_ici: '08:30-17:30', kaynak: src ?? `${web}/iletisim` });
}

// 2) Emniyet: ilçe emniyet santralleri ve polis merkezleri (cep numaraları alınmaz).
const emniyet = JSON.parse(readFileSync('veri-denemesi/acikveri/emniyet.json', 'utf8')) as { u: string; title: string; pairs: [string, string][] }[];
for (const p of emniyet) {
  const ilce = ilceOf(p.title);
  if (!ilce) continue;
  for (const [label, val] of p.pairs) {
    const telefon = tel(val);
    if (label === 'Santral') add({ kategori: 'emniyet', ad: p.title, ilce, telefon, web: 'https://www.bursa.pol.tr', kaynak: p.u });
    else if (/Polis Merkezi/i.test(label) && telefon) {
      const ad = /^Polis Merkezi/i.test(label) ? `${ilce} Polis Merkezi` : label.replace(/ Amirliği$/, '');
      add({ kategori: 'emniyet', ad, ilce, telefon, aciklama: 'Polis merkezi, 7/24 açık', kaynak: p.u });
    }
  }
}

// 3) Adliyeler.
const ADALET = 'https://bursa.adalet.gov.tr/iletisim';
const courts: [string, string, string, string, string][] = [
  ['Bursa Adliyesi', 'Osmangazi', 'Hacıilyas Mah. Kıbrıs Şehitleri Cad. No:21', '02242725004', ADALET],
  ['Bursa Adliyesi Elmas Kule Ek Hizmet Binası', 'Yıldırım', 'Elmasbahçeler Mah. Ankara Yolu Cad. No:34/A', '02245021363', ADALET],
  ['Bursa Çocuk Adalet Merkezi', 'Osmangazi', 'Gaziakdemir Mah. Mudanya Cad. No:4/3', '02242323700', ADALET],
  ['Bursa Adliyesi Altınova Hukuk Ek Binası', 'Yıldırım', 'Altınova Mah. 11 Eylül Blv. No:9', '02242715606', ADALET],
  ['İnegöl Adliyesi', 'İnegöl', 'Kemalpaşa Mah. Adnan Menderes Blv. No:9', '02247151978', 'https://inegol.adalet.gov.tr/iletisim'],
  ['Gemlik Adliyesi', 'Gemlik', 'Hisar Mah. 242. Sok. No:14', '02245135454', 'https://gemlik.adalet.gov.tr/iletisim'],
  ['Mudanya Adliyesi', 'Mudanya', 'Halitpaşa Mah. Mustafa Kemalpaşa Cad. No:114', '02245445050', ADALET],
  ['Mustafakemalpaşa Adliyesi', 'Mustafakemalpaşa', 'Orta Mah. Eski Bursa Cad. No:2', '02246139595', 'https://mustafakemalpasa.adalet.gov.tr/iletisim'],
  ['Keles Adliyesi', 'Keles', 'Cuma Mah. Adnan Menderes Cad. No:18', '02248613374', ADALET],
  ['Orhaneli Adliyesi', 'Orhaneli', 'Gazipaşa Mah. Zafer Cad. Hükümet Konağı', '02248173451', ADALET],
];
for (const [ad, ilce, adres, telefon, kaynak] of courts) add({ kategori: 'adliye', ad, ilce, adres, telefon, calisma_hafta_ici: '08:30-17:30', kaynak });

// 4) İtfaiye: daire başkanlığı ve istasyonlar (istasyonların ayrı telefonu yayımlanmıyor; acil 112).
add({ kategori: 'itfaiye', ad: 'Bursa Büyükşehir Belediyesi İtfaiye Dairesi Başkanlığı', ilce: 'Nilüfer', adres: 'Üçevler Mah. 3. Sok. No:21', telefon: '02247163400', web: 'https://itfaiye.bursa.bel.tr', aciklama: 'Acil durumda 112 aranır.', kaynak: 'https://www.bursa.bel.tr/idari/itfaiye-dairesi-baskanligi-8' });
const ITF = 'https://itfaiye.bursa.bel.tr/tr/sayfa/istasyonlarimiz-3/';
const itf = await lines(ITF);
const start = itf.findIndex((s) => /Küçükbalıklı İtfaiye/i.test(s));
for (let i = start; i >= 0 && i + 1 < itf.length && /İstasyon|Şube Müdürlüğü/i.test(itf[i]!); i += 2) {
  const label = itf[i]!, adres = itf[i + 1]!.replace(/\s*\/\s*BURSA$/i, '').replace(/,\s*\d{5}.*$/, '');
  if (!/İstasyon/i.test(label)) continue; // Yangın Önlem Şube Müdürlüğü bir istasyon değil.
  const ad = label.includes(' - ') ? label.split(' - ').pop()! : label;
  const ilce = ilceOf(itf[i + 1]!);
  add({ kategori: 'itfaiye', ad: /İtfaiye/.test(ad) ? ad : ad.replace('İstasyonu', 'İtfaiye İstasyonu'), ilce, adres: adres.replace(new RegExp(`\\s*${ilce}$`, 'i'), '').replace(/\s*Kumla-$/, ''), aciklama: 'Acil durumda 112 aranır.', kaynak: ITF });
}

// 5) Kültür ve Turizm İl Müdürlüğüne bağlı halk kütüphaneleri (sayfadan: ad, Tel, Posta Adresi, Web).
const KTB = 'https://bursa.ktb.gov.tr/TR-322144/mudurlugumuze-bagli-kutuphaneler.html';
const ktb = await lines(KTB);
for (let i = 1; i < ktb.length; i++) {
  if (ktb[i] !== 'Tel:') continue;
  const ad = ktb[i - 1]!.replace(/ Müdürlüğü$/, '');
  const get = (k: string) => { for (let j = i; j < i + 10 && j < ktb.length; j++) { if (j > i && ktb[j + 1] === 'Tel:') break; if (ktb[j] === k) return ktb[j + 1] ?? ''; } return ''; };
  const post = get('Posta Adresi:');
  const ilce = ilceOf(post) || ilceOf(ad);
  if (!ilce) continue;
  const adres = post.replace(/^Avp\b/, 'Ahmet Vefik Paşa').replace(/\s*\d{5}\s*/, ' ').replace(new RegExp(`\\s*${ilce}\\s*/\\s*Bursa$`, 'i'), '').trim();
  const web = get('Web Adresi:');
  add({ kategori: 'kutuphane', ad, ilce, adres, telefon: tel(ktb[i + 1]!), web: /^https?:/.test(web) ? web : 'https://bursa.ktb.gov.tr', kaynak: KTB });
}
// Bursa Büyükşehir Belediyesi kütüphaneleri (açık veri, konumlu). Kütüphane olmayan "Celal Bayar Evi" alınmaz.
const bbb = JSON.parse(readFileSync('veri-denemesi/acikveri/kutuphaneler.json', 'utf8')) as any;
for (const f of bbb.features) {
  const ad = String(f.properties.title).trim();
  if (!/Kütüphane|Darül Kurra/i.test(ad)) continue;
  const raw = String(f.properties.address);
  const ilce = ilceOf(raw.replace(/Osmangazi̇/g, 'Osmangazi'));
  const [lng, lat] = f.geometry.coordinates as number[];
  const first = raw.split(',')[0]!.trim();
  const mahalle = mahalleOf(raw) || (raw.includes(',') && !/\d|Cd|Cad|Sk|Sok|Blv/i.test(first) ? first : '');
  const adres = raw.replace(/,?\s*(Pk:)?\s*\d{5}.*$/, '').replace(/,\s*Turkey$/, '').replace(/ No: Bila, Alipaşa$/, '');
  add({ kategori: 'kutuphane', ad, ilce, adres, mahalle, enlem: lat!.toFixed(6), boylam: lng!.toFixed(6), web: 'https://www.bursa.bel.tr', not: 'Bursa Büyükşehir Belediyesi açık verisi', kaynak: 'https://acikyesil.bursa.bel.tr/dataset/kutuphaneler' });
}

// 6) Halk eğitim merkezleri (her merkezin MEB sitesi).
const hem: [string, string, string][] = [
  ['Osmangazi', 'Kocanaip Mah. Kaplıca Cad. Dr. Ekrem Paksoy Sok. No:14', '02242201012'],
  ['Gemlik', 'Dr. Ziya Kaya Mah. İstiklal Cad. 4 Nolu Aralık No:2', '02245131846'],
  ['İnegöl', 'Kemalpaşa Mah. Paşaören Sok. No:19', '02247151656'],
  ['Gürsu', 'Kurtuluş OSB Mah. Erol Akbaş Cad. No:27 (Gürsu Anaokulu yanı)', ''],
  ['İznik', 'Selçuk Mah. Süreyya Sok. No:3', ''],
  ['Kestel', 'Yeni Mah. Yavuz Sultan Selim Cad. No:4/4 İç Kapı No:1', '02243722286'],
  ['Mudanya', 'Güzelyalı Eğitim Mah. Anafartalar Cad. İlköğretim Sok. No:22', ''],
  ['Orhangazi', 'Arapzade Mah. 4 No.lu Sok. No:6', '02245731311'],
  ['Orhaneli', 'Gazipaşa Mah. Zafer Cad. No:69', '02248171142'],
  ['Keles', 'Cuma Mah. Atatürk Cad. No:13 İç Kapı No:2', '02248612045'],
  ['Büyükorhan', 'Orhan Mah. Orhan/2 Sok. No:16', '02248412474'],
];
for (const [ilce, adres, telefon] of hem) {
  const web = `https://${host(ilce)}hem.meb.k12.tr`;
  add({ kategori: 'halk-egitim', ad: `${ilce} Halk Eğitimi Merkezi`, ilce, adres, telefon, web, aciklama: 'Ücretsiz meslek ve hobi kursları', kaynak: web + '/' });
}

// Aynı ilçede aynı ad iki kez olmasın (panel aynı kimliği verir).
const seen = new Set<string>();
const uniq = rows.filter((r) => { const k = `${r.kategori}|${r.ilce}|${low(r.ad!)}`; if (seen.has(k)) return false; seen.add(k); return true; });
const keys = citySection('onemli-kurumlar')!.columns.map((c) => c.key);
await writeExcelFile([{ sheet: citySection('onemli-kurumlar')!.sheet, data: [keys, ...uniq.map((r) => keys.map((k) => r[k] ?? ''))].map((r) => r.map((value) => ({ value, type: String }))) as any, stickyRowsCount: 1 }]).toFile(out);
const by = new Map<string, number>();
uniq.forEach((r) => by.set(r.kategori!, (by.get(r.kategori!) ?? 0) + 1));
console.log(`${uniq.length} kurum -> ${out}`, Object.fromEntries(by));
const noIlce = uniq.filter((r) => !r.ilce); if (noIlce.length) console.log('ilçesiz:', noIlce.map((r) => r.ad));
