import { distanceKm } from '../business/business';
import { looksLikeRealEstate } from '../posts/posts';
import { PROVINCE_CENTERS } from '../travel/plan';

/**
 * Çarşı: ikinci el eşya ilanları (PROJE.md 5.1 ilan platformu, 5.11; Karar Eren 31 Ekim 2026: önce eşya, emlak ve araç
 * sonra; adı "Çarşı"). İlanda telefon numarası yoktur, alıcı ile satıcı uygulama içinden yazışır (Mesajlar > Çarşı).
 * İlanı yalnızca e-postası doğrulanmış yetişkin, kayıtlı mahallesiyle verir; ilan verirken telefonun konumu kayıtlı ille
 * karşılaştırılır (sahte konumla aşılabilir, tek önlem sayılmaz). Günlük ilan sınırı, üç şikâyette moderatöre düşme,
 * dolandırıcılık uyarıları. İlan 30 gün yayında kalır, sahibi yeniler. Fotoğraflar Storage (Blaze) ile gelecek.
 */

export const LISTING_KINDS = ['satilik', 'kiralik', 'ucretsiz', 'takas'] as const;
export type ListingKind = (typeof LISTING_KINDS)[number];

/** Emlak ve araç yok (yasal doğrulama hazır olunca Çarşı'nın içinde açılır). */
export const LISTING_CATEGORIES = ['elektronik', 'ev-mobilya', 'ev-aletleri', 'giyim', 'cocuk', 'kitap-hobi', 'spor', 'diger'] as const;
export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

export const LISTING_CATEGORY_ICONS: Record<ListingCategory, string> = {
  elektronik: 'devices',
  'ev-mobilya': 'chair',
  'ev-aletleri': 'kitchen',
  giyim: 'checkroom',
  cocuk: 'child-friendly',
  'kitap-hobi': 'menu-book',
  spor: 'sports-soccer',
  diger: 'category',
};

/** tamir: parça ya da tamir gerekli. */
export const LISTING_CONDITIONS = ['sifir', 'az-kullanilmis', 'kullanilmis', 'tamir'] as const;
export type ListingCondition = (typeof LISTING_CONDITIONS)[number];

export const RENT_UNITS = ['gun', 'hafta', 'ay'] as const;
export type RentUnit = (typeof RENT_UNITS)[number];

/** satildi: sahibi işaretledi (ilan açılır ama listede görünmez, yeni sohbet açılamaz). */
export type ListingStatus = 'yayinda' | 'satildi' | 'kaldirildi';

export interface ListingRegion {
  provinceCode: string;
  districtId: string;
  neighbourhoodId: string;
}

export interface ListingInput {
  kind: ListingKind;
  category: ListingCategory;
  condition: ListingCondition;
  title: string;
  description: string;
  /** TL, tam sayı. Satılık ve kiralıkta zorunlu; ücretsiz ve takasta yok. */
  price: number | null;
  /** Yalnızca kiralıkta. */
  rentUnit: RentUnit | null;
  /** Takasta ne istendiği (isteğe bağlı). */
  swapFor: string;
  /** İlan verenin kayıtlı konumu (kurallar denetler). */
  region: ListingRegion;
}

export interface Listing extends ListingInput {
  id: string;
  ownerUid: string;
  /** "Ayşe K." biçiminde, Keşfet adı. */
  ownerName: string;
  status: ListingStatus;
  /** Storage yolları; Blaze gelene kadar boş. */
  photos: string[];
  reportCount: number;
  /** Moderatör şikâyetleri inceleyip "yerinde kalsın" dedi. */
  cleared: boolean;
  /** Yayına girdiği ya da yenilendiği an; ilan bundan 30 gün sonra listeden düşer. */
  listedAt: string;
  createdAt: string;
}

export const LISTING_LIMITS = {
  title: [3, 80],
  description: 1500,
  swapFor: 120,
  price: [1, 10_000_000],
  /** 24 saatte verilebilecek ilan (yeni hesapta, ilk 7 gün, daha az). */
  perDay: 5,
  perDayNewAccount: 2,
  newAccountDays: 7,
  /** Yayında kalma süresi; son günlerde sahibi yeniler. */
  days: 30,
  renewAfterDays: 27,
  reportThreshold: 3,
  pageSize: 20,
  photos: 6,
  searchKeys: 100,
} as const;

export const LISTING_REPORT_REASONS = ['dolandiricilik', 'yasakli', 'sahte', 'emlak-arac', 'uygunsuz', 'spam', 'diger'] as const;
export type ListingReportReason = (typeof LISTING_REPORT_REASONS)[number];

/** İlan formunda gösterilen yasaklı ürünler (kullanım şartlarıyla birlikte avukata gösterilecek). */
export const PROHIBITED_ITEMS = ['silah', 'ilac', 'alkol-tutun', 'hayvan', 'sahte', 'calinti', 'hesap', 'yetiskin'] as const;

export type ListingError = 'kind' | 'category' | 'condition' | 'title' | 'description' | 'price' | 'rentUnit' | 'swapFor' | 'region' | 'realEstate';

export const listingHasPrice = (kind: ListingKind) => kind === 'satilik' || kind === 'kiralik';

export function validateListing(l: ListingInput): ListingError[] {
  const errors: ListingError[] = [];
  if (!LISTING_KINDS.includes(l.kind)) errors.push('kind');
  if (!LISTING_CATEGORIES.includes(l.category)) errors.push('category');
  if (!LISTING_CONDITIONS.includes(l.condition)) errors.push('condition');
  const title = l.title.trim().length;
  if (title < LISTING_LIMITS.title[0] || title > LISTING_LIMITS.title[1]) errors.push('title');
  if (l.description.trim().length > LISTING_LIMITS.description) errors.push('description');
  if (listingHasPrice(l.kind)) {
    if (l.price == null || !Number.isInteger(l.price) || l.price < LISTING_LIMITS.price[0] || l.price > LISTING_LIMITS.price[1]) errors.push('price');
  } else if (l.price != null) errors.push('price');
  if (l.kind === 'kiralik' ? !l.rentUnit || !RENT_UNITS.includes(l.rentUnit) : l.rentUnit != null) errors.push('rentUnit');
  if (l.swapFor.trim().length > LISTING_LIMITS.swapFor) errors.push('swapFor');
  const r = l.region;
  if (!/^[0-8][0-9]$/.test(r.provinceCode) || !r.districtId.startsWith(`${r.provinceCode}-`) || !r.neighbourhoodId.startsWith(`${r.districtId}-`)) errors.push('region');
  if (looksLikeRealEstate(`${l.title} ${l.description}`)) errors.push('realEstate');
  return errors;
}

/** Fiyat "1.250 TL" biçiminde (kiralıkta "/ ay" ekini ekran çevirir). */
export const parsePrice = (text: string): number | null => {
  const digits = text.replace(/[.\s]/g, '').replace(/,\d*$/, '');
  return /^\d+$/.test(digits) ? Number(digits) : null;
};

/** İlanın listeden düşeceği an (ISO). */
export function listingExpiresAt(l: Pick<Listing, 'listedAt'>): string {
  return new Date(new Date(l.listedAt).getTime() + LISTING_LIMITS.days * 86_400_000).toISOString();
}

/** Listede görünür mü: yayında, süresi dolmamış, şikâyetle düşmemiş. */
export function isListingLive(l: Pick<Listing, 'status' | 'listedAt' | 'reportCount' | 'cleared'>, now = new Date()): boolean {
  return l.status === 'yayinda' && listingExpiresAt(l) > now.toISOString() && (l.cleared || l.reportCount < LISTING_LIMITS.reportThreshold);
}

/** Sahibi yenileyebilir mi (son 3 gün ya da süresi dolmuş). */
export function canRenewListing(l: Pick<Listing, 'status' | 'listedAt'>, now = new Date()): boolean {
  return l.status === 'yayinda' && now.getTime() - new Date(l.listedAt).getTime() >= LISTING_LIMITS.renewAfterDays * 86_400_000;
}

/**
 * Telefonun konumu kayıtlı ilde mi (yaklaşık): en yakın il merkezi kayıtlı ilse ya da kayıtlı ilin merkezi en yakın
 * merkezden en çok 60 km daha uzaktaysa (geniş illerin sınır bölgeleri). Kesin değildir; tek önlem sayılmaz.
 */
export function pointInProvince(p: { lat: number; lng: number }, provinceCode: string): boolean {
  const own = PROVINCE_CENTERS[provinceCode];
  if (!own) return false;
  let nearest = Infinity;
  for (const center of Object.values(PROVINCE_CENTERS)) nearest = Math.min(nearest, distanceKm(p, center));
  return distanceKm(p, own) - nearest <= 60;
}

const placeKey = (s: string) =>
  s
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(ili|province|provinz|il)\b/g, '')
    .replace(/[^a-z]/g, '');

/** Telefonun adres çözümlemesinin verdiği bazı kısa ya da yabancı adlar. */
const PLACE_ALIASES: Record<string, string> = { afyon: 'afyonkarahisar', maras: 'kahramanmaras', urfa: 'sanliurfa', antep: 'gaziantep', izmit: 'kocaeli', adapazari: 'sakarya', icel: 'mersin' };

/**
 * Telefonun adres çözümlemesinden gelen il adını (ör. "Bursa", "İstanbul", "Afyon") il koduna çevirir. Tanınmazsa null
 * (o zaman uzaklık denetimi kullanılır).
 */
export function provinceCodeFromPlaceName(name: string | null | undefined, provinces: readonly { code: string; name: string }[]): string | null {
  if (!name) return null;
  const key = placeKey(name);
  const want = PLACE_ALIASES[key] ?? key;
  return provinces.find((p) => placeKey(p.name) === want)?.code ?? null;
}
