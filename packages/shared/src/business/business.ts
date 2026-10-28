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

/** Ödeme yöntemleri ve olanaklar: işletme sayfasının Bilgiler sekmesinde görünür (PROJE.md 5.7 adım 2). */
export const PAYMENT_METHODS = ['nakit', 'kart', 'temassiz', 'yemek-karti', 'havale'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const AMENITIES = ['paket-servis', 'aile-alani', 'engelli-erisimi', 'otopark', 'wifi', 'cocuk-dostu', 'evcil-hayvan', 'rezervasyon'] as const;
export type Amenity = (typeof AMENITIES)[number];

/** Bir günün açılış ve kapanış saati ("09:00", "23:30"); kapanış açılıştan küçükse gece yarısından sonra kapanır. */
export interface DayHours {
  open: string;
  close: string;
}

/**
 * İşletme yetkilisi (Eren, 28 Ekim 2026): sahibi en çok 3 kişiyi kullanıcı adıyla bulup atar ve izinlerini seçer.
 * Paylaşım: kapalı, sahibinin onayıyla ya da doğrudan.
 */
export const MANAGER_POST_MODES = ['kapali', 'onayla', 'dogrudan'] as const;
export type ManagerPostMode = (typeof MANAGER_POST_MODES)[number];
export interface ManagerPermissions {
  post: ManagerPostMode;
  /** İşletme bilgilerini düzenler (telefon hariç; telefon sahibine bağlıdır). */
  edit: boolean;
  /** Yorumlara işletme adına cevap verir. */
  reply: boolean;
}
export interface BusinessManager extends ManagerPermissions {
  uid: string;
  /** Atanırken görünen adı ("Ayşe K."). */
  name: string;
}
export const BUSINESS_MANAGER_LIMIT = 3;
export const DEFAULT_MANAGER_PERMISSIONS: ManagerPermissions = { post: 'onayla', edit: false, reply: false };

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
  /** Pazartesiden pazara 7 gün; null o gün kapalı. Verilirse "Şu an açık" buradan hesaplanır. */
  weeklyHours?: (DayHours | null)[];
  paymentMethods?: PaymentMethod[];
  amenities?: Amenity[];
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
  /** İşletmeyi takip edenler (kurallar sayacın tam bir değiştiğini denetler). */
  followerCount: number;
  managers: BusinessManager[];
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
  | 'priceList'
  | 'hours';

const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

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
  if (b.weeklyHours && (b.weeklyHours.length !== 7 || b.weeklyHours.some((d) => d && (!TIME.test(d.open) || !TIME.test(d.close) || d.open === d.close)))) errors.push('hours');
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
    ...(b.weeklyHours && !b.is24h && b.weeklyHours.some(Boolean) ? { weeklyHours: b.weeklyHours.map((d) => (d ? { open: d.open, close: d.close } : null)) } : {}),
    paymentMethods: PAYMENT_METHODS.filter((m) => b.paymentMethods?.includes(m)),
    amenities: AMENITIES.filter((m) => b.amenities?.includes(m)),
  };
}

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * "Şu an açık mı?" (işletme sayfası). 7/24 ise hep açık; haftalık saat yoksa bilinmiyor (null). Gece yarısını geçen
 * saatler (18:00-02:00) bir önceki günün açıklığı sayılır. `until`: açıksa kapanış, kapalıysa bugünün açılış saati.
 */
export function openState(b: Pick<BusinessInput, 'is24h' | 'weeklyHours'>, now: Date): { open: boolean; until?: string } | null {
  if (b.is24h) return { open: true };
  const week = b.weeklyHours;
  if (!week || week.length !== 7) return null;
  const day = (now.getDay() + 6) % 7;
  const t = now.getHours() * 60 + now.getMinutes();
  const today = week[day];
  const yesterday = week[(day + 6) % 7];
  if (yesterday && minutes(yesterday.close) < minutes(yesterday.open) && t < minutes(yesterday.close)) return { open: true, until: yesterday.close };
  if (today) {
    const o = minutes(today.open);
    const c = minutes(today.close);
    if (t >= o && (c < o || t < c)) return { open: true, until: today.close };
    if (t < o) return { open: false, until: today.open };
  }
  return { open: false };
}

/** Kişi bu işletme adına paylaşabilir mi; paylaşımı onay mı bekler? Sahibi her zaman doğrudan paylaşır. */
export function postModeFor(b: Pick<Business, 'ownerUid' | 'managers'>, uid: string): 'dogrudan' | 'onayla' | null {
  if (b.ownerUid === uid) return 'dogrudan';
  const m = b.managers.find((x) => x.uid === uid);
  return m && m.post !== 'kapali' ? m.post : null;
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
  /** Ara > İşletmeler: ildeki yayındaki işletmelerden adının bir kelimesi anahtarla başlayanlar (en çok 30). */
  searchByName(provinceCode: string, key: string): Promise<Business[]>;
  get(id: string): Promise<Business | null>;
  listMine(uid: string): Promise<Business[]>;
  /** Kişinin yetkili olduğu (sahibi olmadığı) işletmeler. */
  listManaged(uid: string): Promise<Business[]>;
  /** Sahibi yetkilileri ve izinlerini kaydeder (en çok 3). */
  setManagers(id: string, managers: BusinessManager[]): Promise<void>;
  /** Yetkili kendini çıkarır (hesap silmede de). */
  leaveManaged(id: string, uid: string): Promise<void>;
  follow(id: string, uid: string): Promise<void>;
  unfollow(id: string, uid: string): Promise<void>;
  /** Takip ettiğim işletmelerin kimlikleri (en çok 200). */
  followedIds(uid: string): Promise<string[]>;
  /** Hesap silinirken işletme takipleri ve yetkililikler bırakılır. */
  leaveAllOf(uid: string): Promise<void>;
  create(uid: string, input: BusinessInput): Promise<string>;
  update(id: string, input: BusinessInput): Promise<void>;
  setHidden(id: string, hidden: boolean): Promise<void>;
  delete(id: string): Promise<void>;
  /** Hesap silinirken kullanıcının tüm işletmeleri silinir (KVKK). */
  deleteAllOf(uid: string): Promise<void>;
}
