/**
 * Seyahat > Keşfet ve Öğren (PROJE.md 5.2; 13. madde 34). Coğrafya (ülke, 7 bölge, bölgelerin illeri) sabittir ve
 * koddadır; tanıtım içeriği (bölge ve şehir yazıları, gezilecek yerler) panelden girilir, önce taslak olarak kaydedilir,
 * kontrol edilince yayına alınır. Bu bölümde puanlama yoktur (Karar, Eren). Sayısal bilgiler kaynak ve tarihle gösterilir.
 */

export type TravelStatus = 'taslak' | 'yayinda';

/** Gezilecek yer kategorileri: şehir sayfasındaki seçimler. */
export const TRAVEL_CATEGORIES = ['tarih', 'doga', 'deniz', 'lezzet', 'kultur', 'alisveris'] as const;
export type TravelCategory = (typeof TRAVEL_CATEGORIES)[number];

/** Nasıl gidilir adımlarının ulaşım türü. */
export const TRAVEL_MODES = ['metro', 'otobus', 'tramvay', 'teleferik', 'vapur', 'taksi', 'araba', 'yuruyus'] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];

/** Yakındaki hizmet türleri. */
export const NEARBY_KINDS = ['otopark', 'yemek', 'wc', 'atm', 'saglik'] as const;
export type NearbyKind = (typeof NEARBY_KINDS)[number];

export interface TravelRegionDef {
  id: string;
  countryCode: 'TR';
  /** İller (plaka kodu), Türkiye'nin coğrafi bölge ayrımına göre. */
  provinceCodes: string[];
}

/** Türkiye'nin 7 coğrafi bölgesi ve illeri (toplam 81). Adlar dil dosyalarından gelir (travel.regions.<id>). */
export const TR_REGIONS: TravelRegionDef[] = [
  { id: 'marmara', countryCode: 'TR', provinceCodes: ['34', '22', '39', '59', '17', '10', '16', '11', '77', '41', '54'] },
  { id: 'ege', countryCode: 'TR', provinceCodes: ['35', '45', '09', '20', '48', '64', '43', '03'] },
  { id: 'akdeniz', countryCode: 'TR', provinceCodes: ['07', '32', '15', '33', '01', '31', '80', '46'] },
  { id: 'ic-anadolu', countryCode: 'TR', provinceCodes: ['06', '42', '38', '26', '58', '66', '71', '40', '50', '51', '68', '70', '18'] },
  {
    id: 'karadeniz',
    countryCode: 'TR',
    provinceCodes: ['67', '74', '78', '14', '81', '37', '57', '55', '05', '60', '19', '52', '28', '61', '53', '08', '29', '69'],
  },
  { id: 'dogu-anadolu', countryCode: 'TR', provinceCodes: ['25', '24', '36', '75', '76', '04', '65', '49', '13', '12', '62', '23', '44', '30'] },
  { id: 'guneydogu', countryCode: 'TR', provinceCodes: ['27', '63', '21', '47', '72', '56', '73', '02', '79'] },
];

export function regionOfProvince(provinceCode: string): TravelRegionDef | undefined {
  return TR_REGIONS.find((r) => r.provinceCodes.includes(provinceCode));
}

/** Kaynağı ve tarihi belli bir bilgi ("Uludağ: 2.543 m", kaynak, yıl). */
export interface TravelFact {
  label: string;
  value: string;
  source?: string;
  /** "2024" gibi. */
  asOf?: string;
}

/** Bölge tanıtımı (belge kimliği = bölge kimliği). */
export interface TravelRegionContent {
  id: string;
  /** "Metropol ve Tarih" gibi kısa etiket. */
  tagline: string;
  description: string;
  videoUrl?: string;
  status: TravelStatus;
  updatedAt: string;
}

/** Şehir tanıtımı (belge kimliği = plaka kodu). Şehrin adı il listesinden gelir. */
export interface TravelCityContent {
  id: string;
  regionId: string;
  tagline: string;
  description: string;
  categories: TravelCategory[];
  /** Kartta gösterilen öne çıkan yerler ("Ulu Camii", "Cumalıkızık"). */
  highlights: string[];
  facts: TravelFact[];
  videoUrl?: string;
  status: TravelStatus;
  updatedAt: string;
}

export interface TravelStep {
  mode: TravelMode;
  text: string;
}

export interface TravelNearby {
  kind: NearbyKind;
  text: string;
}

/** Gezilecek yer (deneyim). */
export interface TravelPlace {
  id: string;
  /** Şehrin plaka kodu. */
  cityId: string;
  districtId?: string;
  name: string;
  /** "Tarihi yapı", "UNESCO", "Doğa parkı" gibi kısa tür. */
  kind: string;
  category: TravelCategory;
  /** Kartta görünen bir iki cümle. */
  summary: string;
  about: string;
  history?: string;
  architecture?: string;
  visitingHours?: string;
  entranceFee?: string;
  suggestedDuration?: string;
  address?: string;
  howToGet: TravelStep[];
  nearby: TravelNearby[];
  tips: string[];
  accessibility?: string;
  phone?: string;
  website?: string;
  videoUrl?: string;
  /** "Mutlaka gör" işareti (puan değildir). */
  mustSee: boolean;
  /** Bilginin kaynağı (ör. "Kültür ve Turizm Bakanlığı"). */
  source?: string;
  order: number;
  status: TravelStatus;
  updatedAt: string;
}

export const TRAVEL_LIMITS = {
  tagline: 60,
  description: 600,
  name: 80,
  kind: 40,
  summary: 200,
  longText: 2000,
  shortText: 200,
  listItems: 10,
  highlights: 6,
  facts: 8,
} as const;

export type TravelPlaceInput = Omit<TravelPlace, 'id' | 'updatedAt'>;

export type TravelError = 'name' | 'kind' | 'summary' | 'about' | 'tagline' | 'description' | 'lists' | 'website' | 'video';

const len = (s?: string) => (s ?? '').trim().length;
const httpsOk = (s?: string) => !s || /^https:\/\/\S+$/.test(s.trim());

export function validateTravelPlace(p: TravelPlaceInput): TravelError[] {
  const e: TravelError[] = [];
  const L = TRAVEL_LIMITS;
  if (len(p.name) < 2 || len(p.name) > L.name) e.push('name');
  if (len(p.kind) < 2 || len(p.kind) > L.kind) e.push('kind');
  if (len(p.summary) < 10 || len(p.summary) > L.summary) e.push('summary');
  if (len(p.about) < 10 || len(p.about) > L.longText) e.push('about');
  const short = [p.visitingHours, p.entranceFee, p.suggestedDuration, p.address, p.accessibility, p.phone];
  const long = [p.history, p.architecture];
  if (
    short.some((s) => len(s) > L.shortText) ||
    long.some((s) => len(s) > L.longText) ||
    p.howToGet.length > L.listItems ||
    p.nearby.length > L.listItems ||
    p.tips.length > L.listItems ||
    [...p.howToGet, ...p.nearby].some((x) => !len(x.text) || len(x.text) > L.shortText) ||
    p.tips.some((x) => !len(x) || len(x) > L.shortText)
  )
    e.push('lists');
  if (!httpsOk(p.website)) e.push('website');
  if (!httpsOk(p.videoUrl)) e.push('video');
  return e;
}

export function validateTravelText(c: { tagline: string; description: string; videoUrl?: string }): TravelError[] {
  const e: TravelError[] = [];
  if (len(c.tagline) > TRAVEL_LIMITS.tagline) e.push('tagline');
  if (len(c.description) < 10 || len(c.description) > TRAVEL_LIMITS.description) e.push('description');
  if (!httpsOk(c.videoUrl)) e.push('video');
  return e;
}

/**
 * Ülke şeridi (tasarım: kesfet-ogren.html). Türkiye açık; diğerleri içerik girildikçe açılır, o zamana kadar "yakında".
 * Adlar dil dosyalarından gelir (travel.country.<kod>).
 */
export const TRAVEL_COUNTRIES: { code: string; flag: string; open: boolean }[] = [
  { code: 'TR', flag: '🇹🇷', open: true },
  { code: 'GR', flag: '🇬🇷', open: false },
  { code: 'BG', flag: '🇧🇬', open: false },
  { code: 'RS', flag: '🇷🇸', open: false },
  { code: 'HR', flag: '🇭🇷', open: false },
  { code: 'MK', flag: '🇲🇰', open: false },
  { code: 'ME', flag: '🇲🇪', open: false },
  { code: 'BA', flag: '🇧🇦', open: false },
  { code: 'AL', flag: '🇦🇱', open: false },
  { code: 'SI', flag: '🇸🇮', open: false },
  { code: 'FR', flag: '🇫🇷', open: false },
  { code: 'DE', flag: '🇩🇪', open: false },
  { code: 'IT', flag: '🇮🇹', open: false },
  { code: 'JP', flag: '🇯🇵', open: false },
  { code: 'ES', flag: '🇪🇸', open: false },
];

// ---- 2. aşama: Hazır Rotalar, Yöresel, Başkanlarla Keşif (PROJE.md 5.2) ----

/**
 * Belediyenin hazırladığı içerik CityJoy onayından geçer (siyasi mesaj ve parti işareti yasak): belediye "onaya gönder"ir,
 * admin yayına alır. CityJoy'un kendi içeriği taslak / yayında.
 */
export type TravelReviewStatus = TravelStatus | 'onay-bekliyor';

/** Rota temaları (Eren, 29 Ekim 2026: "Bursa'da 1 gün" yerine temalı rotalar, süre ayrıca yazılır). */
export const ROUTE_THEMES = ['tarih', 'manevi', 'lezzet', 'doga', 'alisveris', 'kultur', 'aile', 'aksam'] as const;
export type RouteTheme = (typeof ROUTE_THEMES)[number];

/** Süre filtresi: 2-3 saat, yarım gün, 1 gün. */
export const ROUTE_LENGTHS = ['kisa', 'yarim', 'tam'] as const;
export type RouteLength = (typeof ROUTE_LENGTHS)[number];

export interface TravelRouteStop {
  /** Gezilecek yerlerden biriyse kimliği: durak ekranında yerin saat, ücret, ulaşım ve ipucu bilgisi de gösterilir. */
  placeId?: string;
  name: string;
  /** Bu durakta ne yapılır (bir iki cümle). */
  note: string;
  /** Önerilen kalış (dakika). */
  stayMinutes?: number;
  /** Bir sonraki durağa nasıl gidilir. */
  next?: TravelStep;
}

/** Hazır rota. Puan ve "keşfeden" sayısı yoktur (Karar, Eren). */
export interface TravelRoute {
  id: string;
  cityId: string;
  /** Belediyenin hazırladığı rota: kurum kimliği ("bld-16-nilufer"). Kartta "Belediye tanıtımı" yazar. */
  municipalityId?: string;
  theme: RouteTheme;
  length: RouteLength;
  title: string;
  summary: string;
  /** Toplam süre (dakika). */
  durationMinutes: number;
  stops: TravelRouteStop[];
  tips: string[];
  order: number;
  status: TravelReviewStatus;
  updatedAt: string;
}

export type TravelRouteInput = Omit<TravelRoute, 'id' | 'updatedAt'>;

/** Yöresel: kültürel miras, el sanatları, lezzetler, gelenekler. */
export const LOCAL_KINDS = ['miras', 'el-sanati', 'lezzet', 'gelenek'] as const;
export type LocalKind = (typeof LOCAL_KINDS)[number];

export interface TravelLocalItem {
  id: string;
  cityId: string;
  kind: LocalKind;
  title: string;
  /** "Dünyanın tek müziksiz halk oyunu" gibi kısa alt başlık. */
  subtitle: string;
  body: string;
  /** "UNESCO", "Coğrafi işaret" gibi rozetler (en çok 4). */
  badges: string[];
  facts: TravelFact[];
  source?: string;
  order: number;
  status: TravelStatus;
  updatedAt: string;
}

export type TravelLocalInput = Omit<TravelLocalItem, 'id' | 'updatedAt'>;

/** Başkanlarla Keşif bölge filtresi (küçük ilçelerin bulunmasına yardım eder). */
export const DISTRICT_ZONES = ['merkez', 'sahil', 'dag', 'ova'] as const;
export type DistrictZone = (typeof DISTRICT_ZONES)[number];

/**
 * Başkanlarla Keşif: belediyenin kendi tanıtımı (belge kimliği = kurum kimliği, "bld-16" il, "bld-16-nilufer" ilçe).
 * Kurallar (Eren onayladı, PROJE.md 5.2): puan yok, bütün ilçeler eşit kart, sıralama nüfusa göre, "Belediye tanıtımı"
 * etiketi, siyasi mesaj yok; seçim döneminde başkan adı gizlenir (showMayor). Nüfus, bölge ve başkan adının
 * gösterilmesini yalnızca CityJoy (admin) belirler; belediye yazıyı, sloganı ve videoyu girer.
 */
export interface TravelMunicipal {
  id: string;
  cityId: string;
  districtId?: string;
  slogan: string;
  description: string;
  videoUrl?: string;
  mayorName?: string;
  /** Admin: seçim döneminde false (yalnızca "Belediye" görünür). */
  showMayor: boolean;
  zone?: DistrictZone;
  /** Admin: TÜİK ADNKS nüfusu ve yılı (sıralama için). */
  population?: number;
  populationYear?: string;
  status: TravelReviewStatus;
  updatedAt: string;
}

/** Belediyenin değiştirebildiği alanlar. */
export type TravelMunicipalText = Pick<TravelMunicipal, 'slogan' | 'description' | 'videoUrl' | 'mayorName'>;

export const ROUTE_LIMITS = { title: 60, summary: 300, stops: 12, note: 300, tips: 6 } as const;

export function validateTravelRoute(r: TravelRouteInput): TravelError[] {
  const e: TravelError[] = [];
  if (len(r.title) < 2 || len(r.title) > ROUTE_LIMITS.title) e.push('name');
  if (len(r.summary) < 10 || len(r.summary) > ROUTE_LIMITS.summary) e.push('summary');
  if (
    r.stops.length < 2 ||
    r.stops.length > ROUTE_LIMITS.stops ||
    r.stops.some((s) => len(s.name) < 2 || len(s.name) > TRAVEL_LIMITS.name || len(s.note) > ROUTE_LIMITS.note || (s.next && (!len(s.next.text) || len(s.next.text) > TRAVEL_LIMITS.shortText))) ||
    r.tips.length > ROUTE_LIMITS.tips ||
    r.tips.some((x) => !len(x) || len(x) > TRAVEL_LIMITS.shortText) ||
    !(r.durationMinutes > 0 && r.durationMinutes <= 24 * 60)
  )
    e.push('lists');
  return e;
}

export function validateTravelLocal(x: TravelLocalInput): TravelError[] {
  const e: TravelError[] = [];
  if (len(x.title) < 2 || len(x.title) > TRAVEL_LIMITS.name) e.push('name');
  if (len(x.subtitle) > TRAVEL_LIMITS.shortText) e.push('summary');
  if (len(x.body) < 10 || len(x.body) > TRAVEL_LIMITS.longText) e.push('about');
  if (x.badges.length > 4 || x.badges.some((b) => !len(b) || len(b) > 30) || x.facts.length > TRAVEL_LIMITS.facts) e.push('lists');
  return e;
}

export function validateTravelMunicipal(m: TravelMunicipalText): TravelError[] {
  const e: TravelError[] = [];
  if (len(m.slogan) < 2 || len(m.slogan) > TRAVEL_LIMITS.tagline) e.push('tagline');
  if (len(m.description) < 10 || len(m.description) > TRAVEL_LIMITS.description) e.push('description');
  if (len(m.mayorName) > TRAVEL_LIMITS.name) e.push('name');
  if (!httpsOk(m.videoUrl)) e.push('video');
  return e;
}

/** Rotanın süresi: "4,5 saat", "45 dk". */
export function routeHours(minutes: number): { hours?: number; minutes?: number } {
  return minutes >= 60 ? { hours: Math.round((minutes / 60) * 2) / 2 } : { minutes };
}

/** Başkanlarla Keşif sıralaması: nüfusa göre büyükten küçüğe; nüfusu girilmemiş olanlar adla sonda (Karar, Eren). */
export function byPopulation<T extends { name: string; population?: number }>(a: T, b: T): number {
  if (a.population != null && b.population != null) return b.population - a.population;
  if (a.population != null) return -1;
  if (b.population != null) return 1;
  return a.name.localeCompare(b.name, 'tr');
}
