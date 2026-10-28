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
