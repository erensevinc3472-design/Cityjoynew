// Gezilecek yerlerin pratik bilgileri (Eren istedi, 11 Kasım 2026): yaş bilgisi, yanına al, kurallar, yakındakiler
// (otopark, WC, yemek), boşsa ziyaret saati, ücret, süre, erişilebilirlik ve ipucu. Önce yerin türüne göre genel bilgi,
// sonra tanınmış yerlere özel not. Kesin saat ve fiyat yazılmaz (yalnızca resmî kaynakta varsa, o da Excel'de zaten
// olan alandır); genel bilgi "genellikle" diye yazılır. Kullanım: pratik-uygula.ts.

export interface Pratik {
  saat?: string;
  ucret?: string;
  sure?: string;
  yakin?: string[]; // "tür: metin" (otopark, yemek, wc, atm, saglik)
  yas?: string;
  bring?: string[];
  rules?: string[];
  erisim?: string;
  tips?: string[];
}

const MOSQUE_RULES = [
  'Kadınlar başını örter; şort, kolsuz ve çok kısa giysiyle girilmez.',
  'Ayakkabılar girişte çıkarılır, raflara ya da poşete konur.',
  'Namaz kılanların önünden geçme, yüksek sesle konuşma.',
  'Namaz sırasında ve flaşla fotoğraf çekme.',
];
const MOSQUE_BRING = ['Başörtüsü (kadınlar için)', 'Kolayca çıkarılan ayakkabı', 'Temiz çorap'];
const NATURE_RULES = [
  'Ateşi yalnızca izin verilen piknik yerlerinde yak; yasak dönemlerde hiç yakma.',
  'Çöpünü topla ve geri götür.',
  'Bitki koparma, yaban hayvanlarını besleme.',
  'İşaretli patikalardan ayrılma.',
];
const RUIN_RULES = [
  'Taşlara, sütunlara ve duvarlara tırmanma.',
  'Mozaik ve kazı alanlarına girme, ipleri ve tabelaları dikkate al.',
  'Ören yerinden taş ya da parça alma; yasaktır.',
  'Drone uçurmak izne bağlıdır.',
];
const MUSEUM_RULES = [
  'Eserlere ve vitrinlere dokunma.',
  'Flaşla fotoğraf çekme; bazı salonlarda fotoğraf tamamen yasak olabilir.',
  'Büyük çanta ve sırt çantası girişte emanete bırakılabilir.',
  'İçeride yiyecek ve içecek tüketme.',
];
const CAVE_RULES = [
  'Sarkıt ve dikitlere dokunma; elin yağı oluşumlarını bozar.',
  'Yürüyüş yolundan ve korkuluklardan ayrılma.',
  'Flaşla fotoğraf çekme, yüksek sesle konuşma.',
];
const VILLAGE_RULES = [
  'Evler özel mülktür; bahçelere ve kapılara izinsiz girme.',
  'İnsanları ve evlerin içini sormadan fotoğraflama.',
  'Dar sokaklarda aracını yolu kapatacak biçimde bırakma.',
];
const WATER_RULES = [
  'Kaygan kayalara çıkma, şelale havuzunda akıntıya dikkat et.',
  'Yağmurdan sonra sel riski olur; suyun yükseldiğini görürsen hemen çık.',
  'Çöpünü topla ve geri götür.',
];
const BEACH_RULES = [
  'Yalnızca cankurtaranlı ve işaretli alanda yüz; kırmızı bayrak varken denize girme.',
  'Çöpünü topla; sigara izmaritini kuma gömme.',
  'Deniz kaplumbağası yuvalarına ve işaretli alanlara dokunma.',
];

const GROUPS: Record<string, Pratik> = {
  cami: {
    saat: 'Gün boyu açık; namaz vakitlerinde, özellikle cuma öğle namazında ziyaret kısıtlanır.',
    ucret: 'Ücretsiz',
    sure: '20–40 dakika',
    yakin: ['wc: Caminin şadırvan tarafında genellikle tuvalet ve abdest alanı bulunur.'],
    yas: 'Yaş sınırı yok. İçeride halı var; bebek arabası girişte bırakılır.',
    bring: MOSQUE_BRING,
    rules: MOSQUE_RULES,
    erisim: 'Tarihî camilerin girişinde çoğunlukla basamak var; avlu genellikle düz.',
    tips: ['Namaz vakitlerini telefonundan kontrol edip arada git.'],
  },
  turbe: {
    saat: 'Gündüz açık; bayram ve kandil günlerinde kalabalık olur.',
    ucret: 'Ücretsiz',
    sure: '15–30 dakika',
    yas: 'Yaş sınırı yok. Türbe içi küçüktür; bebek arabası dışarıda bırakılır.',
    bring: ['Başörtüsü (kadınlar için)', 'Kolayca çıkarılan ayakkabı'],
    rules: [
      'Türbeye ayakkabıyla girilmez; sessiz ol.',
      'Sandukalara dokunma, üzerine bir şey bırakma.',
      'Kadınlar başını örter; omuzları ve dizleri kapatan giysi giy.',
    ],
  },
  kilise: {
    sure: '30–60 dakika',
    yas: 'Yaş sınırı yok. Çocuklar sessiz olmalı; bebek arabası girişte bırakılabilir.',
    bring: ['Omuzları ve dizleri kapatan giysi', 'Su'],
    rules: [
      'Omuzları ve dizleri kapatan giysi giy.',
      'Ayin ya da dua sırasında sessiz ol, fotoğraf çekme.',
      'Duvar resimlerine ve fresklere dokunma, flaş kullanma.',
    ],
  },
  muze: {
    saat: 'Pazartesi kapalı olan müzeler var; yaz ve kış saatleri farklı. Gitmeden resmî siteden kontrol et.',
    sure: '45–90 dakika',
    yakin: ['wc: Müzelerde ziyaretçi tuvaleti bulunur.'],
    yas: 'Yaş sınırı yok. Bebek arabasıyla gezilebilir; tarihî binalarda basamak olabilir.',
    bring: ['Kimlik (indirim ve Müze Kart için)', 'Su'],
    rules: MUSEUM_RULES,
    erisim: 'Yeni müzelerde rampa ve asansör genellikle var; tarihî binalarda üst katlara basamakla çıkılabilir.',
  },
  oren: {
    saat: 'Yaz ve kış saatleri farklı; kapanıştan bir saat önce girişler durabilir. Gitmeden resmî siteden kontrol et.',
    sure: '1–2 saat',
    yakin: [
      'otopark: Girişte genellikle otopark bulunur.',
      'wc: Bilet gişesinin yanında genellikle tuvalet var; alan içinde olmayabilir.',
      'yemek: Alan içinde yemek yeri az; en yakın köy ya da ilçe merkezine git.',
    ],
    yas: 'Yaş sınırı yok. Yollar taşlı ve engebeli; bebek arabası yerine ana kucağı ya da kanguru daha rahat.',
    bring: ['Rahat ve kapalı ayakkabı', 'Şapka ve güneş kremi', 'Bol su', 'Kimlik ve Müze Kart'],
    rules: RUIN_RULES,
    erisim: 'Antik yollar taşlı ve basamaklı; tekerlekli sandalyeyle yalnızca girişe yakın bölümler gezilebilir.',
    tips: ['Yazın sabah erken ya da akşamüstü git; gölge az.'],
  },
  kale: {
    sure: '30–60 dakika',
    yas: 'Yaş sınırı yok. Surların bazı yerlerinde korkuluk yok; küçük çocukları elinden tut.',
    bring: ['Rahat ayakkabı', 'Su', 'Şapka'],
    rules: ['Sur duvarlarının üstüne ve korkuluk olmayan kenarlara çıkma.', 'Taşları sökme, duvarlara yazı yazma.', 'Çöpünü topla.'],
    erisim: 'Kalelere genellikle yokuş ve basamaklarla çıkılır; tekerlekli sandalye için zor.',
    tips: ['Manzara için gün batımına yakın çık.'],
  },
  yapi: {
    sure: '20–45 dakika',
    yas: 'Yaş sınırı yok.',
    bring: ['Rahat ayakkabı'],
    rules: ['Taşlara yazı yazma, süslemelere dokunma.', 'Çöpünü topla.'],
  },
  kopru: {
    saat: 'Açık alan; her zaman görülebilir.',
    ucret: 'Ücretsiz',
    sure: '20–40 dakika',
    yas: 'Yaş sınırı yok. Köprü korkuluklarının alçak olduğu yerlerde çocukları elinden tut.',
    bring: ['Rahat ayakkabı'],
    rules: ['Korkuluklara çıkma, köprüden suya atlama.', 'Taşlara yazı yazma.'],
  },
  magara: {
    sure: '45–90 dakika',
    yas: 'Yaş sınırı yok. Basamak ve kaygan zemin var; bebek arabası girmez, kanguru kullan.',
    bring: ['Kaymayan kapalı ayakkabı', 'İnce bir hırka (içerisi serin)'],
    rules: CAVE_RULES,
    erisim: 'Basamaklı ve kaygan yollar var; tekerlekli sandalyeyle gezilemez.',
    tips: ['İçerisi yaz kış serindir; yazın da yanına ince bir üst al.'],
  },
  yeralti: {
    sure: '45–90 dakika',
    yas: 'Dar ve alçak geçitler var; kapalı yer korkusu olanlar ve sırtı ağrıyanlar için zor olabilir. Bebek arabası girmez.',
    bring: ['Rahat ve kaymayan ayakkabı', 'İnce bir hırka'],
    rules: ['İşaretli yoldan ayrılma, kapalı tünellere girme.', 'Duvarlara dokunma ve yazı yazma.', 'Kalabalıkta sırayı bozma; geçitler tek kişilik.'],
    erisim: 'Dar geçit ve dik basamaklar; tekerlekli sandalyeyle gezilemez.',
    tips: ['Öğle saatlerinde tur grupları çok olur; sabah erken git.'],
  },
  doga: {
    saat: 'Gündüz ziyaret edilir; kışın yollar karlı olabilir.',
    sure: '2–4 saat',
    yakin: [
      'otopark: Millî park ve tabiat parklarında girişte genellikle ücretli otopark var.',
      'wc: Piknik alanlarında genellikle tuvalet bulunur.',
    ],
    yas: 'Yaş sınırı yok. Patikalar engebeli olabilir; küçük çocuklar için kısa yürüyüş seç.',
    bring: ['Yürüyüş ayakkabısı', 'Su ve atıştırmalık', 'Yağmurluk ya da hırka (hava çabuk değişir)', 'Çöp poşeti'],
    rules: NATURE_RULES,
    tips: ['Millî park ve tabiat parklarında gün içi giriş ücreti alınabilir.'],
  },
  yayla: {
    saat: 'En iyi dönem yaz ayları; kışın yollar kapanabilir.',
    sure: 'Yarım gün',
    yas: 'Yaş sınırı yok. Yüksek yerde hava serin; çocuklar için kalın giysi al.',
    bring: ['Kalın bir üst ve yağmurluk', 'Yürüyüş ayakkabısı', 'Nakit (küçük işletmelerde kart geçmeyebilir)'],
    rules: ['Hayvanları ürkütme, otlaklarda çitleri açık bırakma.', 'Çöpünü topla.', 'Yayla evleri özel mülktür; izinsiz girme.'],
    tips: ['Sis ve yağmur sık; hava durumuna bakıp sabah erken çık.'],
  },
  su: {
    saat: 'Gündüz ziyaret edilir; yağışlı günlerde patikalar kayar.',
    sure: '1–2 saat',
    yas: 'Yaş sınırı yok. Kaygan taşlar ve su kenarı var; küçük çocukları yakından izle.',
    bring: ['Kaymayan ayakkabı ya da su ayakkabısı', 'Yedek kıyafet', 'Su ve atıştırmalık'],
    rules: WATER_RULES,
    tips: ['Bahar aylarında su en gürdür.'],
  },
  gol: {
    saat: 'Gün boyu gezilebilir.',
    sure: '1–3 saat',
    yas: 'Yaş sınırı yok. Kıyıda çocukları yalnız bırakma; göller birden derinleşebilir.',
    bring: ['Rahat ayakkabı', 'Şapka ve güneş kremi', 'Su'],
    rules: ['İzin verilmeyen yerlerde göle girme.', 'Kuşları ve yuvaları rahatsız etme.', 'Çöpünü topla, kıyıda ateş yakma.'],
  },
  plaj: {
    saat: 'Yüzme dönemi genellikle haziran–eylül.',
    sure: 'Yarım gün',
    yakin: ['wc: Halk plajlarında genellikle tuvalet ve duş var.'],
    yas: 'Yaş sınırı yok. Çocukları suda yalnız bırakma; sığ yerden yüzmeye başla.',
    bring: ['Güneş kremi ve şapka', 'Havlu ve yedek kıyafet', 'Su'],
    rules: BEACH_RULES,
    tips: ['Halk plajları genellikle ücretsiz; şezlong ve şemsiye ücretli olabilir.'],
  },
  ada: {
    sure: 'Tam gün',
    yas: 'Yaş sınırı yok.',
    bring: ['Güneş kremi ve şapka', 'Rahat ayakkabı', 'Nakit (küçük işletmeler için)'],
    rules: ['Doğal alanlarda çöpünü topla.', 'Yerel halkın evlerine ve bahçelerine izinsiz girme.'],
    tips: ['Feribot ve tekne saatleri mevsime göre değişir; dönüş saatini öğrenmeden çıkma.'],
  },
  koy: {
    saat: 'Gün boyu gezilebilir; dükkânlar genellikle gündüz açık.',
    ucret: 'Ücretsiz',
    sure: '1–3 saat',
    yas: 'Yaş sınırı yok. Sokaklar dar ve arnavut kaldırımı; bebek arabası zorlanabilir.',
    bring: ['Rahat ayakkabı', 'Nakit (küçük dükkânlar için)'],
    rules: VILLAGE_RULES,
    tips: ['Hafta sonu kalabalık olur; hafta içi daha sakin.'],
  },
  carsi: {
    saat: 'Dükkânlar genellikle gündüz açık; pazar günü kapalı olanlar var.',
    ucret: 'Ücretsiz',
    sure: '1–2 saat',
    yas: 'Yaş sınırı yok. Kalabalıkta çocukları elinden tut.',
    bring: ['Nakit (pazarlık ve küçük alışveriş için)', 'Rahat ayakkabı'],
    rules: ['Esnafı sormadan fotoğraflama.', 'Kalabalıkta çantana dikkat et.'],
  },
  kaplica: {
    sure: 'Yarım gün',
    yas: 'Bebekler ve küçük çocuklar sıcak suda kısa kalmalı. Hamilelik, kalp ve tansiyon sorununda önce doktora danış.',
    bring: ['Mayo, havlu ve terlik', 'Yedek kıyafet', 'Su (sıcak suda terlenir)'],
    rules: ['Havuza girmeden duş al.', 'Sıcak suda 15–20 dakikadan uzun kalma, ara ver.', 'Havuz kenarında koşma.'],
    tips: ['Kaplıcaların çoğu ücretlidir; havuz, hamam ve otel fiyatları ayrı olabilir.'],
  },
  kayak: {
    saat: 'Kayak sezonu genellikle aralık–mart; yazın teleferik ve yürüyüş için açık olabilir.',
    sure: 'Tam gün',
    yas: 'Çocuklar için kayak okulu ve kolay pistler var; 4–5 yaştan itibaren ders alınabilir.',
    bring: ['Kalın, su geçirmez giysi', 'Eldiven, bere ve güneş gözlüğü', 'Güneş kremi (kar ışığı yakar)'],
    rules: ['Seviyene uygun pistte kay, kapalı pistlere girme.', 'Kask tak; çocuklar için mutlaka.', 'Pistte durmak için kenara çekil.'],
    tips: ['Kayak takımı ve giysi merkezde kiralanabilir.'],
  },
  sehir: {
    saat: 'Gün boyu gezilebilir.',
    ucret: 'Ücretsiz',
    sure: '1–2 saat',
    yas: 'Yaş sınırı yok.',
    bring: ['Rahat ayakkabı', 'Su'],
    rules: ['Çöpünü topla.', 'Tarihî yapılara yazı yazma.'],
  },
};

const BY_TYPE: Record<string, string> = {
  Cami: 'cami', Türbe: 'turbe', Kilise: 'kilise', Manastır: 'kilise', Bazilika: 'kilise', 'Kaya kilisesi': 'kilise',
  Müze: 'muze', 'Saray müzesi': 'muze', Saray: 'muze',
  'Ören yeri': 'oren', Tapınak: 'oren', 'Antik tiyatro': 'oren', 'Anıt mezar': 'oren', 'Kaya mezarı': 'oren', Höyük: 'oren',
  'Arkeolojik alan': 'oren', Tümülüs: 'oren', 'Kaya anıtı': 'oren', 'Kaya yerleşimi': 'oren', Mezarlık: 'oren',
  Kale: 'kale', Sur: 'kale', 'Tarihî kapı': 'sehir', 'Saat kulesi': 'sehir', Anıt: 'yapi',
  'Tarihî yapı': 'yapi', Medrese: 'yapi', Han: 'yapi', Kervansaray: 'yapi', Hamam: 'yapi', Külliye: 'cami',
  Köprü: 'kopru', 'Tarihî köprü': 'kopru', 'Su kemeri': 'kopru', 'Su kanalı': 'kopru', 'Tarihî kuyu': 'yapi',
  Mağara: 'magara', 'Yeraltı şehri': 'yeralti', 'Yeraltı galerisi': 'yeralti', 'Yeraltı yerleşimi': 'yeralti',
  'Millî park': 'doga', 'Milli park': 'doga', 'Tabiat parkı': 'doga', 'Tabiat alanı': 'doga', 'Tabiatı koruma alanı': 'doga',
  'Tabiat anıtı': 'doga', 'Mesire alanı': 'doga', Orman: 'doga', Arboretum: 'doga', 'Botanik bahçesi': 'doga', Bahçe: 'doga',
  Park: 'doga', 'Sulak alan': 'doga', Dağ: 'doga', Vadi: 'doga', Kaynak: 'doga', Akarsu: 'doga', 'Jeolojik alan': 'doga',
  'Seyir tepesi': 'sehir', 'Seyir noktası': 'sehir', 'Seyir rotası': 'doga', Yayla: 'yayla',
  Şelale: 'su', Kanyon: 'su', Göl: 'gol', 'Baraj gölü': 'gol', Lagün: 'plaj',
  Plaj: 'plaj', Sahil: 'sehir', Ada: 'ada', Yarımada: 'doga', 'İlçe ve sahil': 'ada', 'Sahil köyü': 'koy',
  Köy: 'koy', 'Tarihî köy': 'koy', 'Göl köyü': 'koy', 'Tarihî semt': 'koy', 'Tarihî yerleşim': 'koy',
  'Tarihî çarşı': 'carsi', Çarşı: 'carsi', 'Tarihî alan': 'oren', Kaplıca: 'kaplica', 'Kayak merkezi': 'kayak',
};

/** Ad türden daha belirleyici olduğunda (ör. "Tarihî yapı" olan camiler). */
export function groupOf(tur: string, ad: string): Pratik {
  if (/\bcami/i.test(ad) && !/müze/i.test(ad) && tur !== 'Müze') return GROUPS.cami!;
  if (/türbe/i.test(ad) && tur !== 'Müze') return GROUPS.turbe!;
  return GROUPS[BY_TYPE[tur] ?? 'sehir']!;
}

/** 6 Şubat 2023 depremlerinden etkilenen iller: açık olup olmadığı gitmeden kontrol edilmeli. */
export const DEPREM_ILLER = ['Hatay', 'Kahramanmaraş', 'Malatya', 'Adıyaman', 'Gaziantep', 'Osmaniye'];
/** Ücret alanı Bakanlık tarifesini gösteriyorsa eklenir. */
export const BAKANLIK_IPUCU = 'Bakanlık müze ve ören yerlerinde 18 yaş altı T.C. vatandaşları ücretsizdir; Müze Kart geçerlidir.';
export const DEPREM_IPUCU = '6 Şubat 2023 depremlerinden sonra bazı yapılar onarımda; gitmeden açık olup olmadığını kontrol et.';

/** Tanınmış yerlere özel not ("il|ad"). Burada verilen alan, türün genel bilgisinin yerine geçer; tips eklenir. */
export const OZEL: Record<string, Pratik> = {
  'İstanbul|Ayasofya-i Kebir Camii': {
    sure: '45 dakika – 1 saat',
    tips: ['Yabancı ziyaretçiler üst galeriden ücretli gezer; namaz kılmak ve T.C. vatandaşları için giriş ücretsiz.'],
    yakin: ['yemek: Sultanahmet ve Divanyolu boyunca çok sayıda lokanta var.', 'wc: Meydan çevresinde belediye tuvaletleri var.'],
  },
  'İstanbul|Topkapı Sarayı Müzesi': {
    yas: 'Yaş sınırı yok. Avlular geniş ve yürüyüş uzun; küçük çocuklar için bebek arabası avlularda kullanılabilir.',
    bring: ['Rahat ayakkabı', 'Su', 'Kimlik ve Müze Kart'],
    yakin: ['yemek: Saray içinde kafe var; Sultanahmet\'te çok sayıda lokanta bulunur.', 'otopark: Çevrede otopark az; tramvayla Sultanahmet ya da Gülhane durağında in.'],
  },
  'İstanbul|Sultanahmet Camii': {
    sure: '30–45 dakika',
    yakin: ['otopark: Çevrede otopark az; tramvayla Sultanahmet durağında in.', 'yemek: Sultanahmet ve Divanyolu boyunca çok sayıda lokanta var.'],
  },
  'İstanbul|Süleymaniye Camii': {
    sure: '45 dakika – 1 saat',
    tips: ['Arka avludan Haliç manzarası çok güzeldir; Mimar Sinan\'ın türbesi de külliyededir.'],
    yakin: ['yemek: Külliyenin yanında kuru fasulyecilerle ünlü bir sokak var.'],
  },
  'İstanbul|Kapalıçarşı': {
    saat: 'Pazar günü ve dinî bayramların ilk günü kapalı; diğer günler gündüz açık.',
    sure: '1–3 saat',
  },
  'İstanbul|Yerebatan Sarnıcı': {
    yas: 'Yaş sınırı yok. İçerisi loş ve basamaklı; bebek arabası girişte zorlanır.',
    bring: ['Kaymayan ayakkabı'],
    rules: ['Sütunlara ve Medusa başlarına dokunma.', 'Suya bozuk para ya da bir şey atma.', 'Flaşla fotoğraf çekme.'],
    erisim: 'Girişte ve çıkışta basamak var.',
  },
  'İstanbul|Galata Kulesi': {
    sure: '45 dakika – 1 saat',
    yas: 'Yaş sınırı yok. Seyir balkonu dar; çocukları elinden tut.',
    erisim: 'Kuleye asansörle çıkılır; son kata basamakla.',
    tips: ['Kuyruk uzun olur; sabah açılışta git.'],
  },
  'İstanbul|Dolmabahçe Sarayı': {
    rules: [...MUSEUM_RULES, 'Saray içinde fotoğraf çekmek kısıtlı olabilir; görevlilerin uyarısına uy.'],
  },
  'İstanbul|Kız Kulesi': {
    tips: ['Kuleye Üsküdar ya da Karaköy\'den kalkan teknelerle gidilir; tekne saatlerini önceden öğren.'],
  },
  'Edirne|Selimiye Camii ve Külliyesi': {
    sure: '1 saat',
    tips: ['Külliyedeki Vakıf Müzesi\'ne ve Selimiye Arastası\'na da uğra.'],
  },
  'Çanakkale|Gelibolu Yarımadası Tarihî Alanı': {
    yas: 'Yaş sınırı yok; alan çok geniş, anıtlar arasında araçla dolaşılır.',
    bring: ['Su ve atıştırmalık', 'Şapka', 'Aracın deposu dolu olsun (yarımadada istasyon az)'],
    rules: ['Şehitliklerde sessiz ve saygılı ol.', 'Mezar taşlarının üstüne çıkma, oturma.', 'Siperlere ve tünellere girme.'],
    tips: ['Kabatepe\'deki Çanakkale Destanı Tanıtım Merkezi\'nden başla.'],
  },
  'Çanakkale|Bozcaada': {
    tips: ['Feribot Geyikli İskelesi\'nden kalkar; yazın araçlı geçişte uzun sıra olur, araçsız git.'],
  },
  'Balıkesir|Cunda Adası': {
    bring: ['Rahat ayakkabı', 'Nakit (küçük dükkânlar için)'],
    tips: ['Ayvalık\'a köprüyle bağlıdır; yazın tekneyle de geçilir.'],
  },
  'Balıkesir|Şeytan Sofrası': {
    saat: 'Gün boyu açık; en kalabalık saat gün batımı.',
    ucret: 'Ücretsiz',
    sure: '30–60 dakika',
    tips: ['Gün batımında otopark dolar; biraz erken git.'],
  },
  'İzmir|Efes Ören Yeri': {
    sure: '2–3 saat',
    yakin: ['otopark: Alt ve üst girişte ücretli otopark var.', 'wc: Girişlerde tuvalet var; alan içinde az.', 'yemek: Selçuk merkezinde çok sayıda lokanta var.'],
    tips: ['Üst girişten (Magnesia Kapısı) girip aşağı doğru yürümek daha kolay.'],
  },
  'İzmir|Şirince': {
    tips: ['Hafta sonu çok kalabalık olur; sabah erken git.'],
  },
  'Denizli|Hierapolis ve Pamukkale': {
    sure: '3–4 saat',
    rules: ['Travertenlere ayakkabıyla basılmaz; ayakkabını çıkar.', ...RUIN_RULES.slice(0, 3)],
    bring: ['Kolayca çıkarılan ayakkabı ve poşet', 'Güneş gözlüğü (beyaz yüzey göz alır)', 'Şapka ve güneş kremi', 'Bol su'],
    tips: ['Antik Havuz ayrı ücretlidir; yüzmek istersen mayo al.', 'Gün batımında travertenler çok güzeldir.'],
  },
  'Muğla|Ölüdeniz': {
    rules: ['Tabiat parkı içinde yüzme alanının dışına çıkma.', 'Lagünde tekne ve deniz bisikletine karışma, işaretli alanda kal.', 'Çöpünü topla.'],
    tips: ['Tabiat parkı girişi ücretlidir; halk plajı tarafı ücretsizdir.'],
  },
  'Muğla|Saklıkent Millî Parkı': {
    bring: ['Su ayakkabısı (kanyon içinde suda yürünür)', 'Yedek kıyafet', 'Su geçirmez telefon kılıfı'],
    rules: WATER_RULES,
    tips: ['Kanyon suyu yazın bile çok soğuktur.', 'Kanyonda yalnızca izin verilen bölüme kadar yürü.'],
  },
  'Muğla|İztuzu Plajı': {
    rules: ['Gece plaja girilmez; deniz kaplumbağaları yumurtlar.', 'İşaretli yuvalara dokunma, kumda çukur kazma.', 'Şemsiyeyi yalnızca ön sıralardaki izinli alana kur.'],
  },
  'Muğla|Sedir Adası': {
    rules: ['Kleopatra Plajı\'nın kumu korunur; kuma uzanma, kumu dışarı çıkarma.', 'Ören yeri kurallarına uy.'],
    tips: ['Adaya Çamlı ya da Taşbükü\'nden teknelerle gidilir.'],
  },
  'Nevşehir|Göreme Açık Hava Müzesi': {
    rules: ['Kaya kiliselerinin içinde fotoğraf çekmek yasak olabilir; görevlilere uy.', 'Fresklere dokunma.', 'Kapalı alanlarda sırayı bozma.'],
    tips: ['Karanlık Kilise ayrı ücretlidir ve en iyi korunmuş freskler oradadır.'],
  },
  'Nevşehir|Uçhisar Kalesi': {
    tips: ['Tepeye dik basamaklarla çıkılır; manzara Kapadokya\'nın en genişidir.'],
  },
  'Aksaray|Ihlara Vadisi': {
    sure: '2–4 saat',
    bring: ['Yürüyüş ayakkabısı', 'Su ve atıştırmalık', 'Fener (kaya kiliseleri karanlık)'],
    tips: ['Vadiye 300\'den fazla basamakla inilir; Belisırma\'da dere kenarında lokantalar var.'],
  },
  'Ankara|Anıtkabir': {
    saat: 'Her gün açık; resmî tören günlerinde ziyaret saatleri değişebilir.',
    ucret: 'Ücretsiz',
    sure: '1–2 saat',
    yas: 'Yaş sınırı yok.',
    bring: ['Kimlik', 'Rahat ayakkabı'],
    rules: ['Mozolede sessiz ve saygılı ol.', 'Askerî nöbetçilere dokunma, yollarını kesme.', 'Girişte güvenlik araması yapılır.'],
    tips: ['Kurtuluş Savaşı Müzesi Anıtkabir\'in altındadır, atlama.'],
  },
  'Ankara|Anadolu Medeniyetleri Müzesi': {
    sure: '1,5–2 saat',
    tips: ['Ankara Kalesi yürüme mesafesinde; ikisini birlikte gez.'],
  },
  'Konya|Mevlana Müzesi': {
    yas: 'Yaş sınırı yok.',
    bring: ['Başörtüsü (kadınlar için)'],
    rules: ['Türbe bölümünde sessiz ol, sandukalara dokunma.', 'Girişte ayakkabıya galoş giyilir.', 'Flaşla fotoğraf çekme.'],
    tips: ['Aralıktaki Şeb-i Arûs törenleri döneminde çok kalabalık olur.'],
  },
  'Nevşehir|Derinkuyu Yeraltı Şehri': {
    tips: ['Sekiz kata kadar inilir; dar geçitlerde eğilerek yürünür.'],
  },
  'Trabzon|Sümela Manastırı': {
    sure: '1,5–2 saat',
    yas: 'Yaş sınırı yok. Manastıra uzun ve dik bir yürüyüş yolundan çıkılır; bebek arabası uygun değil.',
    bring: ['Yürüyüş ayakkabısı', 'Yağmurluk', 'Su'],
    rules: ['Fresklere dokunma, flaş kullanma.', 'İşaretli yoldan ayrılma.', 'Kayalık kenarlara yaklaşma.'],
    tips: ['Altındere Vadisi\'nde sis sık olur; sabah erken git.'],
  },
  'Trabzon|Uzungöl': {
    tips: ['Hafta sonu çok kalabalık olur; hafta içi ve sabah erken git.'],
  },
  'Rize|Ayder Yaylası': {
    tips: ['Kaplıcası ücretlidir; mayo al.', 'Yazın hafta sonu yolda trafik olur.'],
  },
  'Burdur|Salda Gölü': {
    rules: ['Beyaz kumsal alanına girmek yasak olabilir; yalnızca izin verilen yerlerden göle gir.', 'Gölde sabun, şampuan ve krem kullanma.', 'Çöpünü topla, beyaz kumu alma.'],
    tips: ['Yüzme yalnızca belirlenmiş halk plajında serbest.'],
  },
  'Antalya|Aspendos Örenyeri': {
    tips: ['Tiyatronun en üst sırasından sesin ne kadar iyi geldiğini dene.'],
  },
  'Antalya|Kaleiçi': {
    yas: 'Yaş sınırı yok. Sokaklar yokuşlu ve taşlı; bebek arabası zorlanabilir.',
  },
  'Antalya|Damlataş Mağarası': {
    tips: ['Mağaranın havası nemli ve sıcaktır; astım hastalarına iyi geldiği söylenir.'],
  },
  'Adıyaman|Nemrut Dağı Örenyeri': {
    sure: '2–3 saat (gün doğumu ya da gün batımı)',
    yas: 'Yaş sınırı yok. Otoparktan zirveye yaklaşık 20–30 dakika dik ve taşlı bir yolla yürünür.',
    bring: ['Kalın mont (zirve yazın bile soğuktur)', 'Yürüyüş ayakkabısı', 'Fener (gün doğumu için)', 'Su'],
    tips: ['Yol kışın kardan kapanır; ziyaret dönemi genellikle nisan–ekim.', 'Gün doğumu için gece yola çıkılır; konaklamayı yakın köyde planla.'],
  },
  'Şanlıurfa|Göbeklitepe Örenyeri': {
    tips: ['Ziyaretçi merkezindeki tanıtım filmini izleyip alana öyle gir.', 'Şanlıurfa Arkeoloji Müzesi\'ndeki buluntularla birlikte gez.'],
    yakin: ['otopark: Ziyaretçi merkezinde otopark var.', 'wc: Ziyaretçi merkezinde tuvalet ve kafe var.'],
  },
  'Şanlıurfa|Balıklıgöl': {
    saat: 'Gün boyu açık.',
    ucret: 'Ücretsiz',
    sure: '1 saat',
    rules: ['Balıklar kutsal sayılır; tutmak ve zarar vermek yasaktır.', 'Balıklara yalnızca satılan yemi ver.', 'Camilerde kıyafet kurallarına uy.'],
    bring: ['Başörtüsü (kadınlar için, camiler için)'],
  },
  'Kars|Ani Örenyeri': {
    sure: '2–3 saat',
    tips: ['Alan çok geniş ve gölge yok; şapka ve su al.', 'Sınır bölgesindedir; işaretli alanın dışına çıkma.'],
  },
  'Ağrı|İshak Paşa Sarayı': {
    tips: ['Doğubayazıt\'a yukarıdan bakar; gün batımı manzarası çok güzeldir.'],
  },
  'Van|Akdamar Adası ve Kilisesi': {
    tips: ['Adaya Gevaş\'tan kalkan teknelerle gidilir; tekne ücreti ayrıdır.'],
    bring: ['Güneş kremi ve şapka', 'Rahat ayakkabı'],
  },
  'Mardin|Mor Gabriel Manastırı': {
    saat: 'Gündüz belli saatlerde açık; öğle arasında ve ayin sırasında ziyaret yapılmaz.',
    rules: ['Burası yaşayan bir manastırdır; sessiz ve saygılı ol.', 'Omuzları ve dizleri kapatan giysi giy.', 'Rahiplerin ve yaşayanların fotoğrafını sormadan çekme.'],
  },
  'Mardin|Deyrulzafaran Manastırı': {
    saat: 'Gündüz açık; öğle arasında ve ayin sırasında ziyaret yapılmaz.',
    rules: ['Burası yaşayan bir manastırdır; sessiz ve saygılı ol.', 'Omuzları ve dizleri kapatan giysi giy.', 'Rehber eşliğinde gezilir.'],
  },
  'Karabük|Safranbolu Tarihî Çarşı': {
    tips: ['Cinci Hanı ve Kaymakamlar Evi\'ni gör; Hıdırlık Tepesi\'nden çarşıya yukarıdan bak.'],
  },
  'Bolu|Yedigöller Millî Parkı': {
    tips: ['Yol kışın kardan kapanabilir; sonbaharda yaprak renkleri en güzel hâlindedir.'],
  },
  'Bolu|Abant Gölü Millî Parkı': {
    tips: ['Göl çevresi yaklaşık 7 km yürüyüş yolu; araç girişi ücretlidir.'],
  },
  'Kayseri|Erciyes Kayak Merkezi': {
    tips: ['Kayseri merkezden yaklaşık 25 km; sezonda belediye otobüsü ile gidilir.'],
  },
  'Erzurum|Palandöken Kayak Merkezi': {
    tips: ['Erzurum merkeze çok yakın; sezonda hafta sonları kalabalık olur.'],
  },
  'Gaziantep|Zeugma Mozaik Müzesi': {
    sure: '1,5–2 saat',
    tips: ['Çingene Kızı mozaiği ayrı, karanlık bir odada sergilenir.'],
  },
  'Gaziantep|Bakırcılar Çarşısı': {
    tips: ['Ustaları çalışırken izleyebilirsin; fotoğraf için önce sor.'],
  },
  'Diyarbakır|Diyarbakır Surları': {
    rules: ['Burçlara ve korkuluksuz bölümlere çıkma.', 'Taşlara yazı yazma.'],
    tips: ['Dağ Kapı ile Mardin Kapı arasındaki burçlar en kolay gezilen bölümdür.'],
  },
  'Çorum|Hattuşa': {
    sure: '2–3 saat',
    tips: ['Alan 6 km\'lik bir yolla araçla dolaşılır; yakındaki Yazılıkaya\'yı ve Boğazköy Müzesi\'ni de gör.'],
  },
  'Artvin|Borçka Karagöl': {
    tips: ['Göl çevresinde kısa bir yürüyüş yolu var; sonbaharda renkler çok güzeldir.'],
  },
  'Bitlis|Nemrut Krater Gölü': {
    saat: 'Yol yalnızca yazın açık (genellikle haziran–ekim).',
    tips: ['Krater içine toprak yolla inilir; hava hızlı değişir, kalın giysi al.'],
  },
  'Tunceli|Munzur Gözeleri': {
    rules: ['Gözeler inanç yeri sayılır; suya saygılı ol, kirletme.', 'Mum ve adak alanlarına dokunma.', 'Çöpünü topla.'],
  },
  'Sinop|Sinop Tarihî Cezaevi': {
    yas: 'Yaş sınırı yok. Hücreler ve koğuşlar küçük çocukları ürkütebilir.',
  },
};
