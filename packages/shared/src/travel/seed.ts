import type { TravelCityContent, TravelPlaceInput, TravelRegionContent } from './travel';

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
