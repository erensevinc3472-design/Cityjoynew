import type { MembershipTier } from '../models/membership';
import { isReservedName } from '../organizations/municipalities';

/** İşletme türü (PROJE.md 5.7 adım 1). Belediye, kurum, kulüp ve muhtar hesapları bu akışta değildir. */
export const BUSINESS_TYPES = ['hizmet', 'esnaf', 'evden-uretim', 'yeme-icme', 'konaklama', 'yol-ustu', 'emlak'] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

/** Ev adresi gösterilmeyen türler: konum mahalle düzeyinde kalır (PROJE.md 5.7, ev işletmeleri için gizlilik). */
export const HOME_BASED_TYPES: readonly BusinessType[] = ['evden-uretim'];

export type VerificationStatus = 'dogrulanmadi' | 'inceleniyor' | 'dogrulandi';
/** yayinda: herkes görür; gizli: sahibi kapattı; kaldirildi: yönetim kaldırdı (sahibi açamaz). */
export type BusinessStatus = 'yayinda' | 'gizli' | 'kaldirildi';

export interface PriceItem {
  name: string;
  /** Serbest metin: "500 TL", "300-450 TL", "keşiften sonra". */
  price: string;
}

/** Sahibinin girdiği bilgiler. Doğrulama, kademe, puan ve öne çıkma yalnızca sunucu/yönetim tarafından yazılır. */
export interface BusinessInput {
  type: BusinessType;
  name: string;
  /** Hizmet alt kategorileri (en az 1, en çok 5). */
  categoryIds: string[];
  location: { provinceCode: string; districtId: string; neighbourhoodId?: string };
  /** Açık adres (dükkân vb.). Evden çalışan işletmelerde boş kalır. */
  address?: string;
  /** Yalnızca rakam; kartta görünür. */
  phone: string;
  whatsapp: boolean;
  is24h: boolean;
  /** "Hafta içi 09.00-18.00" gibi. */
  hoursNote?: string;
  description?: string;
  priceList: PriceItem[];
}

export interface Business extends BusinessInput {
  id: string;
  ownerUid: string;
  status: BusinessStatus;
  verification: { status: VerificationStatus; verifiedAt?: string };
  membership: { tier: MembershipTier; endsAt?: string };
  /** Ücretli öne çıkma bitişi (ISO); kartta "Reklam" etiketi çıkar. */
  featuredUntil?: string;
  /** Yayındaki değerlendirmelerin yıldız toplamı ve sayısı; ortalama hesaplanır (kurallar toplamı denetler). */
  rating: { sum: number; count: number };
  /** ISO tarihler. */
  createdAt: string;
  updatedAt: string;
}

export const BUSINESS_LIMITS = {
  name: [2, 80],
  categories: [1, 5],
  address: 200,
  hoursNote: 120,
  description: 500,
  priceItems: 30,
  priceName: 80,
  priceValue: 40,
} as const;

export type BusinessError =
  | 'name'
  | 'reservedName'
  | 'categories'
  | 'location'
  | 'phone'
  | 'address'
  | 'hoursNote'
  | 'description'
  | 'priceList';

/** Form doğrulaması; aynı sınırlar veritabanı kurallarında da var. */
export function validateBusiness(b: BusinessInput): BusinessError[] {
  const errors: BusinessError[] = [];
  const len = (s: string | undefined) => (s ?? '').trim().length;
  if (len(b.name) < BUSINESS_LIMITS.name[0] || len(b.name) > BUSINESS_LIMITS.name[1]) errors.push('name');
  // Belediye ve resmî kurum adları kilitli (PROJE.md 6.7).
  else if (isReservedName(b.name)) errors.push('reservedName');
  if (b.categoryIds.length < BUSINESS_LIMITS.categories[0] || b.categoryIds.length > BUSINESS_LIMITS.categories[1]) errors.push('categories');
  if (!/^[0-8][0-9]$/.test(b.location.provinceCode) || !b.location.districtId.startsWith(`${b.location.provinceCode}-`)) errors.push('location');
  if (!/^[0-9]{10,13}$/.test(b.phone)) errors.push('phone');
  if (len(b.address) > BUSINESS_LIMITS.address || (HOME_BASED_TYPES.includes(b.type) && len(b.address) > 0)) errors.push('address');
  if (len(b.hoursNote) > BUSINESS_LIMITS.hoursNote) errors.push('hoursNote');
  if (len(b.description) > BUSINESS_LIMITS.description) errors.push('description');
  if (
    b.priceList.length > BUSINESS_LIMITS.priceItems ||
    b.priceList.some((p) => !len(p.name) || len(p.name) > BUSINESS_LIMITS.priceName || !len(p.price) || len(p.price) > BUSINESS_LIMITS.priceValue)
  )
    errors.push('priceList');
  return errors;
}

/** Kaydetmeden önce boşlukları temizler, boş alanları atar. */
export function cleanBusinessInput(b: BusinessInput): BusinessInput {
  const opt = (s?: string) => (s?.trim() ? s.trim() : undefined);
  return {
    type: b.type,
    name: b.name.trim(),
    categoryIds: [...new Set(b.categoryIds)],
    location: b.location.neighbourhoodId ? b.location : { provinceCode: b.location.provinceCode, districtId: b.location.districtId },
    ...(opt(b.address) && !HOME_BASED_TYPES.includes(b.type) ? { address: opt(b.address) } : {}),
    phone: b.phone.replace(/\D/g, ''),
    whatsapp: b.whatsapp,
    is24h: b.is24h,
    ...(opt(b.hoursNote) ? { hoursNote: opt(b.hoursNote) } : {}),
    ...(opt(b.description) ? { description: opt(b.description) } : {}),
    priceList: b.priceList.map((p) => ({ name: p.name.trim(), price: p.price.trim() })).filter((p) => p.name || p.price),
  };
}

/** "905321234567" gibi uluslararası biçim (WhatsApp bağlantısı için). */
export function internationalPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('90')) return d;
  if (d.startsWith('0')) return `90${d.slice(1)}`;
  return `90${d}`;
}

export function whatsappUrl(phone: string): string {
  return `https://wa.me/${internationalPhone(phone)}`;
}

/** Yıldız ortalaması (değerlendirme yoksa 0). */
export function averageRating(r: { sum: number; count: number }): number {
  return r.count ? Math.round((r.sum / r.count) * 10) / 10 : 0;
}

/** En fazla kaç "Reklam" etiketli kart üstte durur (Karar, Eren). */
export const MAX_FEATURED = 2;
/** Puan hesabında az yorumlu işletmeyi ortalamaya çeken ağırlık. */
const PRIOR_COUNT = 5;
const PRIOR_AVG = 4;

/**
 * Yorum sayısını hesaba katan puan: 1 yorumla 5 yıldız, 200 yorumla 4,8'in önüne geçemez.
 * Sıralamada eşitlik oluşsun diye 0,1'e yuvarlanır (sonra yakınlık ve güncellik devreye girer).
 */
export function weightedRating(r: { sum: number; count: number }): number {
  const score = (PRIOR_AVG * PRIOR_COUNT + r.sum) / (PRIOR_COUNT + r.count);
  return Math.round(score * 10) / 10;
}

/**
 * Öne çıkma yalnızca belgeleri doğrulanmış işletmede geçerlidir: doğrulanmamış bir işletme parayla
 * en üste çıkamaz (acil kategorilerde dolandırıcılık riski; kampanya modülü de yalnızca doğrulanmışlarda).
 */
export function isFeatured(b: Pick<Business, 'featuredUntil' | 'verification'>, now: Date): boolean {
  return b.verification.status === 'dogrulandi' && !!b.featuredUntil && new Date(b.featuredUntil) > now;
}

export interface RankedBusinesses {
  /** "Reklam" etiketiyle en üstte gösterilir. */
  featured: Business[];
  /** Herkes için aynı kuralla sıralanmış liste. */
  others: Business[];
}

/**
 * Hizmet listesi sıralaması (Karar, Eren; PROJE.md 5.6). Kural herkes için aynıdır ve yayımlanır:
 * 1) en çok 2 öne çıkan (doğrulanmış) kart "Reklam" etiketiyle en üstte,
 * 2) kalanlar: doğrulanmışlar önce, sonra yorum sayısını hesaba katan puan, sonra kullanıcının
 *    ilçesindekiler, sonra bilgisi en yeni güncellenen.
 * Üyelik kademesi sıralamaya girmez (yalnızca vitrin kapasitesini belirler).
 */
export function rankBusinesses(list: readonly Business[], opts: { districtId?: string; now?: Date } = {}): RankedBusinesses {
  const now = opts.now ?? new Date();
  const visible = list.filter((b) => b.status === 'yayinda');
  const compare = (a: Business, b: Business) =>
    Number(b.verification.status === 'dogrulandi') - Number(a.verification.status === 'dogrulandi') ||
    weightedRating(b.rating) - weightedRating(a.rating) ||
    Number(b.location.districtId === opts.districtId) - Number(a.location.districtId === opts.districtId) ||
    b.updatedAt.localeCompare(a.updatedAt) ||
    a.id.localeCompare(b.id);
  // Öne çıkanlar arasında da aynı kural geçerli; sınırı aşan öne çıkanlar normal sıraya döner.
  const featured = visible.filter((b) => isFeatured(b, now)).sort(compare).slice(0, MAX_FEATURED);
  const featuredIds = new Set(featured.map((b) => b.id));
  return { featured, others: visible.filter((b) => !featuredIds.has(b.id)).sort(compare) };
}

export interface BusinessRepository {
  /** Bir ilde, bir hizmet alt kategorisindeki yayındaki işletmeler (en çok 100). */
  listByCategory(provinceCode: string, categoryId: string): Promise<Business[]>;
  get(id: string): Promise<Business | null>;
  listMine(uid: string): Promise<Business[]>;
  create(uid: string, input: BusinessInput): Promise<string>;
  update(id: string, input: BusinessInput): Promise<void>;
  setHidden(id: string, hidden: boolean): Promise<void>;
  delete(id: string): Promise<void>;
  /** Hesap silinirken kullanıcının tüm işletmeleri silinir (KVKK). */
  deleteAllOf(uid: string): Promise<void>;
}
