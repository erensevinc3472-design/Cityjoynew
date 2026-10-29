/**
 * Benim Şehrim > "Nasıl yapılır?" ülke geneli rehberleri (81 ilde görünür). Panelin "Excel'den yükle" biçiminde dosya
 * üretir ve panelin denetiminden geçirir. Bilgiler resmî kaynak sayfalarına dayanır; ücret, süre gibi değişebilen
 * ayrıntılar bilerek yazılmadı. Yüklenince "doğrulanmadı" görünür; ekip kaynaktan kontrol edip doğrular.
 *
 * Kullanım: npx vite-node scripts/nasil-yapilir.ts
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import writeExcelFile from 'write-excel-file/node';
import { citySection, parseCitySheet } from '@cityjoy/shared';

import districts from '../packages/shared/data/locations/districts.json';
import provinces from '../packages/shared/data/locations/provinces.json';

const today = new Date();
const dateText = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;
const EDEVLET = 'https://www.turkiye.gov.tr';

/** Adımlar "|" ile, belgeler "," ile ayrılır (panel biçimi); belge adlarında virgül kullanılmaz. */
const GUIDES: Record<string, string>[] = [
  {
    kategori: 'resmi-islem',
    baslik: 'e-Devlet şifresi nasıl alınır?',
    kisa_metin: 'e-Devlet\'e şifreyle ya da internet bankacılığı, mobil imza veya e-imza ile girebilirsiniz. Şifreyi PTT şubelerinden kimliğinizle alırsınız.',
    adimlar: 'Kimlik kartınızla bir PTT şubesine gidin | e-Devlet şifresi istediğinizi söyleyin, şifre zarfı size verilir | turkiye.gov.tr adresinde T.C. kimlik numaranız ve bu şifreyle giriş yapın | İlk girişte şifrenizi değiştirin',
    gerekli_belgeler: 'Geçerli kimlik kartı',
    ilgili_baglanti: EDEVLET,
    kaynak: EDEVLET,
    not: 'Şifreyi yalnızca kişinin kendisi alabilir. Banka ile giriş için internet bankacılığınızın olması yeterlidir.',
  },
  {
    kategori: 'resmi-islem',
    baslik: 'Adres değişikliği nasıl bildirilir?',
    kisa_metin: 'Taşındığınızda yeni adresinizi nüfus müdürlüğüne ya da e-Devlet üzerinden bildirmeniz gerekir. Bildirim yasal süre içinde yapılmalıdır.',
    adimlar: 'e-Devlet\'te "Yerleşim Yeri (İkametgâh) ve Diğer Adres Değişikliği Bildirimi" hizmetini açın | Yeni adresinizi seçin ve adresi gösteren belgeyi yükleyin | Başvurunuz onaylanınca adresiniz güncellenir | e-Devlet yerine nüfus müdürlüğüne gidip de bildirebilirsiniz',
    gerekli_belgeler: 'Kimlik kartı, Kira sözleşmesi ya da tapu, Yeni adrese ait elektrik su veya doğalgaz faturası',
    ilgili_baglanti: EDEVLET,
    kaynak: EDEVLET,
    not: 'Bildirimi geç yapmak para cezasına yol açabilir.',
  },
  {
    kategori: 'resmi-islem',
    baslik: 'İkametgâh (yerleşim yeri belgesi) nasıl alınır?',
    kisa_metin: 'Yerleşim yeri belgesini e-Devlet\'ten barkodlu olarak hemen alabilirsiniz. Kurumlar barkodla belgenin doğruluğunu kontrol eder.',
    adimlar: 'e-Devlet\'te "Yerleşim Yeri ve Diğer Adres Belgesi Sorgulama" hizmetini açın | Belgenin kimin için ve nereye verileceğini seçin | Barkodlu belgeyi indirin ya da yazdırın',
    ilgili_baglanti: EDEVLET,
    kaynak: EDEVLET,
  },
  {
    kategori: 'resmi-islem',
    baslik: 'Kimlik kartı ve pasaport için randevu nasıl alınır?',
    kisa_metin: 'Kimlik kartı, pasaport ve ehliyet işlemleri için nüfus müdürlüğünden randevu alınır.',
    adimlar: 'randevu.nvi.gov.tr adresine girin | İşlem türünü ve size yakın nüfus müdürlüğünü seçin | Uygun gün ve saati seçip randevuyu onaylayın | Randevu günü gerekli belgelerle müdürlüğe gidin',
    gerekli_belgeler: 'Mevcut kimlik kartı, Biyometrik fotoğraf (pasaport için)',
    ilgili_baglanti: 'https://randevu.nvi.gov.tr',
    kaynak: 'https://randevu.nvi.gov.tr',
    not: 'Ücretli işlemlerde ödeme vergi dairesine ya da anlaşmalı bankalara yapılır; güncel tutarı randevu sayfasından kontrol edin.',
  },
  {
    kategori: 'saglik',
    baslik: 'Hastane randevusu (MHRS) nasıl alınır?',
    kisa_metin: 'Devlet hastaneleri ve aile hekimleri için randevuyu MHRS\'den alırsınız: internetten, mobil uygulamadan ya da telefonla.',
    adimlar: 'mhrs.gov.tr adresine ya da MHRS uygulamasına e-Devlet ile giriş yapın | İl, hastane ve bölümü seçin | Uygun saati seçip randevuyu onaylayın | İnternet kullanamıyorsanız ALO 182\'yi arayın',
    ilgili_baglanti: 'https://www.mhrs.gov.tr',
    kaynak: 'https://www.mhrs.gov.tr',
    not: 'Gidemeyecekseniz randevunuzu iptal edin; iptal edilmeyen randevular yeni randevu almanızı kısıtlayabilir.',
  },
  {
    kategori: 'resmi-islem',
    baslik: 'Zorunlu deprem sigortası (DASK) nasıl yapılır?',
    kisa_metin: 'Konutlar için zorunlu deprem sigortası DASK poliçesidir. Su ve elektrik aboneliği ile tapu işlemlerinde poliçe istenir.',
    adimlar: 'Bir sigorta şirketine, acenteye ya da bankaya başvurun | Konutun adres bilgisini (UAVT kodu) verin | Poliçe ücretini ödeyin ve poliçenizi alın | Poliçenizi her yıl yenileyin',
    gerekli_belgeler: 'Kimlik bilgisi, Konutun adresi ya da UAVT adres kodu',
    ilgili_baglanti: 'https://www.dask.gov.tr',
    kaynak: 'https://www.dask.gov.tr',
    not: 'Poliçenizin geçerli olup olmadığını DASK\'ın sitesinden sorgulayabilirsiniz.',
  },
  {
    kategori: 'pratik',
    baslik: 'Su aboneliği nasıl açılır?',
    kisa_metin: 'Yeni bir eve taşındığınızda su aboneliği, ilinizdeki ya da belediyenizdeki su idaresinden açılır.',
    adimlar: 'İlinizdeki su idaresinin sitesine ya da hizmet noktasına başvurun (birçoğu e-Devlet\'te de hizmet verir) | Kimlik ve konut belgelerinizi verin | Güvence bedelini ödeyin | Sayaç açılınca aboneliğiniz başlar',
    gerekli_belgeler: 'Kimlik kartı, Kira sözleşmesi ya da tapu, Geçerli DASK poliçesi',
    ilgili_baglanti: EDEVLET,
    kaynak: 'https://www.dask.gov.tr',
    not: 'Su idaresinin adı ve başvuru yolu ile değişir; Benim Şehrim > Belediye Hizmetleri\'nde ilinizin bilgisine bakın.',
  },
  {
    kategori: 'resmi-islem',
    baslik: 'Vergi borcu nasıl sorgulanır ve ödenir?',
    kisa_metin: 'Vergi borçlarınızı Gelir İdaresi\'nin İnteraktif Vergi Dairesi\'nden ya da e-Devlet\'ten sorgulayıp kartla ödeyebilirsiniz.',
    adimlar: 'ivd.gib.gov.tr adresine e-Devlet ile giriş yapın | "Borç sorgulama" bölümünü açın | Ödemek istediğiniz borcu seçip banka kartı ya da kredi kartıyla ödeyin',
    ilgili_baglanti: 'https://ivd.gib.gov.tr',
    kaynak: 'https://ivd.gib.gov.tr',
  },
  {
    kategori: 'ulasim',
    baslik: 'Trafik cezası nasıl sorgulanır?',
    kisa_metin: 'Adınıza ya da aracınıza yazılmış trafik cezalarını e-Devlet\'ten sorgulayabilirsiniz.',
    adimlar: 'e-Devlet\'te "Trafik Cezası Sorgulama" hizmetini açın | Kendi adınıza ya da plakaya göre sorgulayın | Ödenmemiş cezaları vergi dairesine ya da bankanıza ödeyin',
    ilgili_baglanti: EDEVLET,
    kaynak: EDEVLET,
    not: 'Tebliğden sonraki belirli süre içinde ödenen cezalarda indirim uygulanır; süreyi ceza tutanağından kontrol edin.',
  },
  {
    kategori: 'resmi-islem',
    baslik: 'Devlete şikâyet ve dilekçe (CİMER) nasıl iletilir?',
    kisa_metin: 'Kamu kurumlarıyla ilgili istek, öneri ve şikâyetlerinizi CİMER üzerinden iletebilirsiniz.',
    adimlar: 'cimer.gov.tr adresine e-Devlet ile giriş yapın | Başvuru türünü seçip konunuzu açık ve kısa yazın | Varsa belgelerinizi ekleyip gönderin | Başvurunuzun sonucunu aynı sayfadan takip edin',
    ilgili_baglanti: 'https://www.cimer.gov.tr',
    kaynak: 'https://www.cimer.gov.tr',
  },
  {
    kategori: 'pratik',
    baslik: 'Tüketici şikâyeti nasıl yapılır?',
    kisa_metin: 'Bir ürün ya da hizmetle ilgili sorununuz çözülmezse Tüketici Hakem Heyeti\'ne e-Devlet üzerinden başvurabilirsiniz.',
    adimlar: 'Önce satıcıya ya da firmaya yazılı olarak başvurun | Çözülmezse e-Devlet\'te "Tüketici Bilgi Sistemi" (TÜBİS) üzerinden Tüketici Hakem Heyeti\'ne başvurun | Fatura ve yazışmalarınızı ekleyin | Bilgi almak için ALO 175\'i arayabilirsiniz',
    gerekli_belgeler: 'Fatura ya da fiş, Varsa garanti belgesi, Satıcıyla yazışmalar',
    ilgili_baglanti: 'https://tuketici.ticaret.gov.tr',
    kaynak: 'https://tuketici.ticaret.gov.tr',
  },
  {
    kategori: 'pratik',
    baslik: 'Acil durum toplanma alanı nasıl öğrenilir?',
    kisa_metin: 'Deprem gibi afetlerde gideceğiniz en yakın toplanma alanını e-Devlet\'ten öğrenebilirsiniz.',
    adimlar: 'e-Devlet\'te "Acil Durum Toplanma Alanı Sorgulama" hizmetini açın | Adresinizi seçin | Size en yakın toplanma alanlarını haritada görün ve ailenizle paylaşın',
    ilgili_baglanti: EDEVLET,
    kaynak: EDEVLET,
    not: 'Benim Şehrim > Toplanma alanları bölümünde de ilinizdekiler listelenir.',
  },
];

const section = citySection('nasil-yapilir')!;
const keys = section.columns.map((c) => c.key);
const data = [keys, ...GUIDES.map((g) => keys.map((k) => (k === 'kaynak_tarihi' ? dateText : (g[k] ?? ''))))];
const { items, errors } = parseCitySheet('nasil-yapilir', data, { provinces, districts, today });
console.log(`${section.sheet}: ${GUIDES.length} rehber · hazır ${items.length} · düzeltilecek ${errors.length}`);
for (const e of errors) console.log(`  satır ${e.row}: ${e.message}`);

const outDir = path.join(process.cwd(), 'veri-denemesi');
mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'nasil-yapilir-turkiye.xlsx');
await writeExcelFile([
  {
    data: [
      ['"Nasıl yapılır?" ülke geneli rehberleri: 81 ilde görünür.'],
      [`Tarih: ${dateText}. Kaynaklar resmî sayfalar; yüklenince "doğrulanmadı" görünür, kontrol edilince doğrulanır.`],
    ],
    sheet: 'Okuyun',
  },
  { data, sheet: section.sheet, stickyRowsCount: 1 },
]).toFile(out);
console.log(`Dosya: ${out}`);
