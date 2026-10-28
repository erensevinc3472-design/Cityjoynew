import type { TravelCityContent, TravelLocalInput, TravelPlaceInput, TravelRegionContent, TravelRouteInput } from './travel';

/**
 * Başlangıç içeriği (Marmara ve Bursa). Panelden "taslak" olarak yüklenir; ekip doğruluğunu kontrol edip yayına alır.
 * Saat, ücret, telefon gibi değişebilen bilgiler bilerek boş bırakıldı: resmî kaynaktan kontrol edilip girilmeli.
 */
export const SEED_REGIONS: Omit<TravelRegionContent, 'status' | 'updatedAt'>[] = [
  {
    id: 'marmara',
    tagline: 'Tarih, deniz ve şehir',
    description:
      'İstanbul\'un iki kıtaya yayılan silueti, Osmanlı\'nın ilk başkenti Bursa, Çanakkale\'nin tarihî yarımadası ve Edirne\'nin camileri. Marmara, Türkiye\'nin en kalabalık ve en çok gezilen bölgesi.',
  },
];

export const SEED_CITIES: Omit<TravelCityContent, 'status' | 'updatedAt'>[] = [
  {
    id: '16',
    regionId: 'marmara',
    tagline: 'Osmanlı\'nın ilk başkenti',
    description:
      'Osmanlı Devleti\'nin ilk başkenti Bursa; külliyeleri, tarihî hanları ve çarşısı, Uludağ\'ı, kaplıcaları ve İskender kebabıyla tanınır. Şehir merkezi ile Cumalıkızık köyü birlikte UNESCO Dünya Mirası Listesi\'ndedir.',
    categories: ['tarih', 'doga', 'lezzet', 'alisveris'],
    highlights: ['Ulu Camii', 'Cumalıkızık', 'Uludağ', 'Koza Han'],
    facts: [
      { label: 'UNESCO Dünya Mirası', value: 'Bursa ve Cumalıkızık: Osmanlı İmparatorluğu\'nun Doğuşu', source: 'UNESCO', asOf: '2014' },
      { label: 'En yüksek nokta', value: 'Uludağ, 2.543 m' },
    ],
  },
];

const place = (p: Omit<TravelPlaceInput, 'status' | 'howToGet' | 'nearby' | 'tips' | 'mustSee'> & Partial<TravelPlaceInput>): Omit<TravelPlaceInput, 'status'> => ({
  howToGet: [],
  nearby: [],
  tips: [],
  mustSee: false,
  ...p,
});

export const SEED_PLACES: { id: string; data: Omit<TravelPlaceInput, 'status'> }[] = [
  {
    id: 'bursa-ulu-camii',
    data: place({
      cityId: '16',
      districtId: '16-osmangazi',
      name: 'Ulu Camii',
      kind: 'Tarihî yapı',
      category: 'tarih',
      summary: 'Yıldırım Bayezid\'in yaptırdığı, 20 kubbeli ve içinde şadırvanı olan erken Osmanlı camisi.',
      about:
        'Ulu Camii, 14. yüzyılın sonunda Yıldırım Bayezid tarafından yaptırıldı. 20 kubbesi, iç mekândaki şadırvanı ve duvarlarındaki büyük hat yazılarıyla tanınır. Ceviz ağacından kündekâri tekniğiyle yapılmış minberi ayrıca dikkat çeker.',
      architecture: 'Kareye yakın dikdörtgen planlı, kubbelerin ayaklara oturduğu çok kubbeli bir yapıdır. Ortadaki kubbenin altında şadırvan bulunur.',
      tips: ['Namaz vakitlerinde ziyaret kısıtlanabilir; vakitleri önceden kontrol edin.', 'Kadın ziyaretçilerin başörtüsü getirmesi önerilir.'],
      mustSee: true,
      order: 1,
    }),
  },
  {
    id: 'bursa-yesil-turbe',
    data: place({
      cityId: '16',
      districtId: '16-yildirim',
      name: 'Yeşil Türbe ve Yeşil Camii',
      kind: 'Tarihî yapı',
      category: 'tarih',
      summary: 'Çelebi Mehmed\'in türbesi; dış ve iç yüzeyleri çinilerle kaplı, şehrin simgelerinden biri.',
      about:
        'Yeşil Türbe, Sultan Çelebi Mehmed için 15. yüzyılın başında yapıldı. Adını yüzeylerini kaplayan yeşil-turkuaz çinilerden alır. Hemen karşısındaki Yeşil Camii ile birlikte gezilir.',
      tips: ['Türbe içinde sessiz olun, çinileri flaşsız fotoğraflayın.', 'Yeşil Camii ile birlikte gezmek yaklaşık bir saat sürer.'],
      mustSee: true,
      order: 2,
    }),
  },
  {
    id: 'bursa-cumalikizik',
    data: place({
      cityId: '16',
      districtId: '16-yildirim',
      name: 'Cumalıkızık',
      kind: 'UNESCO köy',
      category: 'kultur',
      summary: 'Uludağ eteğinde, taş sokakları ve eski evleriyle Osmanlı döneminden kalma bir köy.',
      about:
        'Cumalıkızık, Osmanlı\'nın kuruluş döneminden kalma bir köydür. Dar taş sokakları, ahşap ve kerpiç evleri hâlâ yaşayan bir köy dokusunu korur. 2014\'te Bursa\'daki tarihî alanlarla birlikte UNESCO Dünya Mirası Listesi\'ne girdi.',
      tips: ['Hafta sonları kalabalık olabilir; sabah erken gitmek daha sakin olur.', 'Köyde yaşayanların evlerine ve mahremiyetine saygı gösterin.'],
      mustSee: true,
      source: 'UNESCO Dünya Mirası Listesi',
      order: 3,
    }),
  },
  {
    id: 'bursa-koza-han',
    data: place({
      cityId: '16',
      districtId: '16-osmangazi',
      name: 'Koza Han',
      kind: 'Tarihî han',
      category: 'alisveris',
      summary: 'İpek ticaretinin merkezi olan, avlusunda küçük bir mescit bulunan 15. yüzyıl hanı.',
      about:
        'Koza Han, 15. yüzyılın sonunda II. Bayezid döneminde yapıldı ve uzun yıllar ipek kozası ticaretinin merkezi oldu. Bugün dükkânlarında ipek ürünleri satılır, avlusundaki çay bahçesi dinlenmek için uğranan yerlerdendir.',
      order: 4,
    }),
  },
  {
    id: 'bursa-muradiye',
    data: place({
      cityId: '16',
      districtId: '16-osmangazi',
      name: 'Muradiye Külliyesi',
      kind: 'Külliye',
      category: 'tarih',
      summary: 'II. Murad\'ın yaptırdığı cami, medrese ve bahçe içindeki türbelerden oluşan külliye.',
      about:
        'Muradiye Külliyesi, II. Murad döneminde yapıldı. Cami, medrese, hamam ve ağaçlı bir bahçe içindeki hanedan türbelerinden oluşur. UNESCO Dünya Mirası alanının parçalarından biridir.',
      order: 5,
    }),
  },
  {
    id: 'bursa-tophane',
    data: place({
      cityId: '16',
      districtId: '16-osmangazi',
      name: 'Tophane, Osman ve Orhan Gazi Türbeleri',
      kind: 'Tarihî alan',
      category: 'tarih',
      summary: 'Osmanlı\'nın kurucularının türbeleri, Saat Kulesi ve şehre bakan seyir noktası.',
      about:
        'Tophane, Bursa kalesinin içinde, şehre tepeden bakan bir alandır. Osman Gazi ve Orhan Gazi\'nin türbeleri ile Saat Kulesi buradadır. Seyir terasından şehir ve ova manzarası görülür.',
      order: 6,
    }),
  },
  {
    id: 'bursa-uludag',
    data: place({
      cityId: '16',
      name: 'Uludağ',
      kind: 'Dağ ve milli park',
      category: 'doga',
      summary: 'Marmara\'nın en yüksek dağı; kışın kayak, yazın yürüyüş ve piknik.',
      about:
        'Uludağ, 2.543 metreyle Marmara Bölgesi\'nin en yüksek noktasıdır. Milli park içindeki kayak merkezi kış aylarında, yürüyüş yolları ve piknik alanları yaz aylarında ziyaret edilir. Şehirden teleferikle de çıkılabilir.',
      tips: ['Hava dağda şehirden çok daha soğuk ve değişken olabilir; yanınıza kalın giysi alın.', 'Kış lastiği ve zincir kurallarını yola çıkmadan kontrol edin.'],
      mustSee: true,
      order: 7,
    }),
  },
  {
    id: 'bursa-iskender',
    data: place({
      cityId: '16',
      name: 'İskender kebap',
      kind: 'Yöresel lezzet',
      category: 'lezzet',
      summary: 'Pide üzerinde döner, domates sosu, tereyağı ve yoğurtla: Bursa\'nın en bilinen lezzeti.',
      about:
        'İskender kebap Bursa\'da doğmuş, Türkiye\'nin her yerinde bilinen bir yemektir. İnce kesilmiş döner, tırnaklı pide üzerine dizilir; domates sosu ve kızgın tereyağı dökülür, yanında yoğurtla servis edilir. Şehirde birçok kebapçıda bulunur.',
      order: 8,
    }),
  },
  {
    id: 'bursa-kestane-sekeri',
    data: place({
      cityId: '16',
      name: 'Kestane şekeri',
      kind: 'Yöresel lezzet',
      category: 'lezzet',
      summary: 'Şekerle pişirilmiş kestaneden yapılan, Bursa\'nın en çok hediye alınan tatlısı.',
      about: 'Kestane şekeri, kestanenin şeker şurubunda uzun süre pişirilip kurutulmasıyla yapılır. Şehrin hemen her yerinde, özellikle çarşı çevresinde satılır.',
      order: 9,
    }),
  },
];

/**
 * Bursa hazır rotaları (temalı; süre ayrıca). Duraklar mümkün olduğunca gezilecek yerlere bağlıdır. Ulaşım satırları
 * genel tutuldu; hat ve durak adları kontrol edilip panelden eklenmeli.
 */
export const SEED_ROUTES: { id: string; data: Omit<TravelRouteInput, 'status'> }[] = [
  {
    id: 'bursa-osmanli-dogusu',
    data: {
      cityId: '16',
      theme: 'tarih',
      length: 'yarim',
      title: 'Osmanlı\'nın Doğuşu',
      summary: 'Osmanlı\'nın ilk başkentinde kurucu sultanların türbelerinden Ulu Camii\'ye ve ipek hanlarına uzanan yürüyüş rotası.',
      durationMinutes: 270,
      stops: [
        { placeId: 'bursa-tophane', name: 'Tophane, Osman ve Orhan Gazi Türbeleri', note: 'Güne şehre tepeden bakarak başlayın: türbeler ve Saat Kulesi.', stayMinutes: 45, next: { mode: 'yuruyus', text: 'Yokuş aşağı yaklaşık 15 dakika yürüyüş' } },
        { placeId: 'bursa-ulu-camii', name: 'Ulu Camii', note: '20 kubbe, şadırvan ve hat yazıları.', stayMinutes: 40, next: { mode: 'yuruyus', text: 'Birkaç dakikalık yürüyüş' } },
        { placeId: 'bursa-koza-han', name: 'Koza Han', note: 'Avludaki çay bahçesinde mola, ipek dükkânları.', stayMinutes: 45, next: { mode: 'yuruyus', text: 'Çarşı içinden yürüyerek' } },
        { name: 'Hanlar Bölgesi ve Kapalı Çarşı', note: 'Emir Han, Fidan Han ve çarşı sokakları.', stayMinutes: 60, next: { mode: 'taksi', text: 'Taksi ya da otobüsle kısa bir yol' } },
        { placeId: 'bursa-muradiye', name: 'Muradiye Külliyesi', note: 'Ağaçlı bahçedeki türbelerle sakin bir kapanış.', stayMinutes: 50 },
      ],
      tips: ['Sabah erken başlayın, öğle kalabalığından kaçının.', 'Rahat ayakkabı giyin: rotanın çoğu yürüyüş.'],
      order: 1,
    },
  },
  {
    id: 'bursa-camiler-turbeler',
    data: {
      cityId: '16',
      theme: 'manevi',
      length: 'yarim',
      title: 'Camiler ve Türbeler',
      summary: 'Erken Osmanlı mimarisinin en güzel örnekleri: Ulu Camii, çinileriyle Yeşil Türbe ve Yeşil Camii, Muradiye.',
      durationMinutes: 240,
      stops: [
        { placeId: 'bursa-ulu-camii', name: 'Ulu Camii', note: 'Kündekâri minber ve iç mekândaki şadırvan.', stayMinutes: 40, next: { mode: 'taksi', text: 'Taksi ya da otobüsle kısa bir yol' } },
        { placeId: 'bursa-yesil-turbe', name: 'Yeşil Türbe ve Yeşil Camii', note: 'Türbenin çinilerini ve caminin taç kapısını görün.', stayMinutes: 60, next: { mode: 'taksi', text: 'Taksi ya da otobüsle' } },
        { name: 'Emir Sultan Camii ve Türbesi', note: 'Şehre bakan avlusuyla sevilen bir ziyaret yeri.', stayMinutes: 40, next: { mode: 'taksi', text: 'Taksi ya da otobüsle şehrin batısına' } },
        { placeId: 'bursa-muradiye', name: 'Muradiye Külliyesi', note: 'Hanedan türbeleri ve bahçe.', stayMinutes: 50 },
      ],
      tips: ['Namaz vakitlerinde ziyaret kısıtlanabilir; vakitleri önceden kontrol edin.', 'Kadın ziyaretçilerin başörtüsü getirmesi önerilir.'],
      order: 2,
    },
  },
  {
    id: 'bursa-gastro',
    data: {
      cityId: '16',
      theme: 'lezzet',
      length: 'kisa',
      title: 'Gastro Bursa',
      summary: 'İskender\'den pideli köfteye, çarşıda kestane şekerinden Koza Han\'da çaya: Bursa\'nın sofrası.',
      durationMinutes: 180,
      stops: [
        { placeId: 'bursa-iskender', name: 'İskender kebap', note: 'Tereyağı masada dökülür, yanında yoğurt.', stayMinutes: 60, next: { mode: 'yuruyus', text: 'Çarşıya doğru yürüyerek' } },
        { name: 'Pideli köfte ve cantık', note: 'Bursa\'nın pideli köftesi ve kıymalı cantığı.', stayMinutes: 40, next: { mode: 'yuruyus', text: 'Yürüyerek' } },
        { placeId: 'bursa-kestane-sekeri', name: 'Kestane şekeri', note: 'Çarşıda tadın, hediyelik paket alın.', stayMinutes: 20, next: { mode: 'yuruyus', text: 'Birkaç dakikalık yürüyüş' } },
        { placeId: 'bursa-koza-han', name: 'Koza Han\'da çay', note: 'Avluda çay ya da Türk kahvesiyle kapanış.', stayMinutes: 40 },
      ],
      tips: ['Aç gelin, porsiyonlar doyurucu.', 'Kalabalık saatlerde İskender için sıra olabilir.'],
      order: 3,
    },
  },
  {
    id: 'bursa-uludag-rotasi',
    data: {
      cityId: '16',
      theme: 'doga',
      length: 'tam',
      title: 'Uludağ',
      summary: 'Teleferikle şehirden dağa: manzara, yürüyüş yolları, kışın kayak. Mevsime göre bütün bir gün.',
      durationMinutes: 420,
      stops: [
        { name: 'Teleferik', note: 'Şehirden Uludağ\'a teleferikle çıkış; yolculuk boyunca şehir manzarası.', stayMinutes: 60, next: { mode: 'teleferik', text: 'Teleferikle yukarı' } },
        { placeId: 'bursa-uludag', name: 'Uludağ Milli Parkı', note: 'Yazın yürüyüş ve piknik, kışın kayak.', stayMinutes: 300, next: { mode: 'teleferik', text: 'Teleferikle dönüş' } },
        { name: 'Akşam şehirde', note: 'Dönüşte şehir merkezinde akşam yemeği.', stayMinutes: 60 },
      ],
      tips: ['Hava dağda şehirden çok daha soğuk ve değişken olabilir; yanınıza kalın giysi alın.', 'Teleferik çalışma saatlerini ve hava koşullarını yola çıkmadan kontrol edin.'],
      order: 4,
    },
  },
  {
    id: 'bursa-carsi-hanlar',
    data: {
      cityId: '16',
      theme: 'alisveris',
      length: 'kisa',
      title: 'Çarşı ve Hanlar',
      summary: 'Yüzyıllık hanlar ve kapalı çarşı: ipek, bıçak, havlu ve yöresel ürünler.',
      durationMinutes: 150,
      stops: [
        { placeId: 'bursa-koza-han', name: 'Koza Han', note: 'İpek şal ve eşarp dükkânları.', stayMinutes: 40, next: { mode: 'yuruyus', text: 'Yürüyerek' } },
        { name: 'Kapalı Çarşı', note: 'Bursa havlusu, bıçak ve hediyelik.', stayMinutes: 60, next: { mode: 'yuruyus', text: 'Yürüyerek' } },
        { name: 'Emir Han ve Fidan Han', note: 'Avlularda çay molası.', stayMinutes: 40 },
      ],
      tips: ['Pazar günü bazı dükkânlar kapalı olabilir.'],
      order: 5,
    },
  },
  {
    id: 'bursa-cumalikizik-rotasi',
    data: {
      cityId: '16',
      theme: 'kultur',
      length: 'yarim',
      title: 'Cumalıkızık Köy Rotası',
      summary: 'Uludağ eteğinde, UNESCO listesindeki köyde taş sokaklar, eski evler ve köy kahvaltısı.',
      durationMinutes: 240,
      stops: [
        { name: 'Köy kahvaltısı', note: 'Köydeki kahvaltı evlerinden birinde güne başlayın.', stayMinutes: 75, next: { mode: 'yuruyus', text: 'Köy içinde yürüyerek' } },
        { placeId: 'bursa-cumalikizik', name: 'Cumalıkızık sokakları', note: 'Taş sokaklar, ahşap ve kerpiç evler.', stayMinutes: 90, next: { mode: 'yuruyus', text: 'Yürüyerek' } },
        { name: 'Köy pazarı', note: 'Ev yapımı reçel, erişte ve el işleri.', stayMinutes: 30 },
      ],
      tips: ['Hafta sonları kalabalık olabilir; sabah erken gitmek daha sakin olur.', 'Köyde yaşayanların evlerine ve mahremiyetine saygı gösterin.'],
      order: 6,
    },
  },
];

/** Yöresel Bursa. Rozet ve sayılar yalnızca kaynağı kesin olanlarda; coğrafi işaretler kontrol edilip panelden eklenmeli. */
export const SEED_LOCAL: { id: string; data: Omit<TravelLocalInput, 'status'> }[] = [
  {
    id: 'bursa-karagoz',
    data: {
      cityId: '16',
      kind: 'miras',
      title: 'Karagöz ve Hacivat',
      subtitle: 'Gölge oyununun şehri',
      body:
        'Karagöz gölge oyunu geleneği, insanlığın somut olmayan kültürel mirası listesindedir. Rivayete göre Karagöz ve Hacivat, Orhan Gazi döneminde Bursa\'da bir cami inşaatında çalışan iki ustadır. Şehirdeki Karagöz Müzesi\'nde tasvirler ve gösteriler görülebilir.',
      badges: ['UNESCO'],
      facts: [{ label: 'UNESCO listesi', value: 'Karagöz', source: 'UNESCO', asOf: '2009' }],
      order: 1,
    },
  },
  {
    id: 'bursa-kilic-kalkan',
    data: {
      cityId: '16',
      kind: 'gelenek',
      title: 'Kılıç Kalkan',
      subtitle: 'Müziksiz oynanan halk oyunu',
      body:
        'Kılıç Kalkan, Bursa\'ya özgü, müzik olmadan yalnızca kılıç ve kalkan sesleriyle oynanan bir halk oyunudur. Oyuncular geleneksel kıyafetleriyle selamlaşma, kılıç bileme ve çarpışma figürlerini canlandırır. Şehirdeki törenlerde ve festivallerde izlenebilir.',
      badges: [],
      facts: [],
      order: 2,
    },
  },
  {
    id: 'bursa-ipek',
    data: {
      cityId: '16',
      kind: 'el-sanati',
      title: 'İpekçilik',
      subtitle: 'Koza Han\'dan dünyaya',
      body: 'Bursa, yüzyıllar boyunca ipek böcekçiliği ve ipekli dokumanın merkezi oldu; kumaşları saraylara kadar ulaştı. Bugün Koza Han\'daki dükkânlarda ipek şal ve eşarplar satılır.',
      badges: [],
      facts: [],
      order: 3,
    },
  },
  {
    id: 'bursa-bicak',
    data: {
      cityId: '16',
      kind: 'el-sanati',
      title: 'Bursa bıçağı',
      subtitle: 'Çarşıda hâlâ yaşayan zanaat',
      body: 'Bursa bıçakçılığı, şehrin en bilinen el sanatlarından biridir. Çarşıdaki bıçakçılarda el yapımı bıçaklar bulunur.',
      badges: [],
      facts: [],
      order: 4,
    },
  },
  {
    id: 'bursa-lezzet-iskender',
    data: {
      cityId: '16',
      kind: 'lezzet',
      title: 'İskender kebap',
      subtitle: 'Bursa\'nın en bilinen lezzeti',
      body: 'Pide üzerine dizilen ince döner, domates sosu, kızgın tereyağı ve yoğurt. Şehirde doğup bütün Türkiye\'ye yayıldı.',
      badges: [],
      facts: [],
      order: 5,
    },
  },
  {
    id: 'bursa-lezzet-kestane',
    data: {
      cityId: '16',
      kind: 'lezzet',
      title: 'Kestane şekeri',
      subtitle: 'En çok hediye alınan tatlı',
      body: 'Kestanenin şeker şurubunda uzun süre pişirilip kurutulmasıyla yapılır. Çarşı çevresinde her yerde bulunur.',
      badges: [],
      facts: [],
      order: 6,
    },
  },
];
