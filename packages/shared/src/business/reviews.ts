/**
 * İşletme değerlendirmeleri (PROJE.md 5.6, 13 madde 17). Kurallar:
 * - yalnızca giriş yapmış ve işletmeyi uygulamadan aramış / WhatsApp'tan yazmış kişi yazar,
 * - kişi başına işletme başına bir değerlendirme (düzenlenebilir, silinebilir), sahibi kendine yazamaz,
 * - işletme sahibinin cevap hakkı vardır, her yorum şikâyet edilebilir, yönetim gizleyebilir.
 */
export interface Review {
  /** Yazanın kimliği (belge kimliği de budur). */
  uid: string;
  businessId: string;
  stars: number;
  text: string;
  /** "Ali D." biçiminde; tam ad gösterilmez. */
  authorName: string;
  status: 'yayinda' | 'gizlendi';
  /** ISO tarihler. */
  createdAt: string;
  updatedAt: string;
  reply?: { text: string; at: string };
}

export const REVIEW_TEXT = [10, 500] as const;
export const REPLY_TEXT = [2, 500] as const;

export const REPORT_REASONS = ['hakaret', 'sahte', 'kisisel-veri', 'alakasiz', 'diger'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export function isValidStars(stars: number): boolean {
  return Number.isInteger(stars) && stars >= 1 && stars <= 5;
}

export function isValidReviewText(text: string): boolean {
  const n = text.trim().length;
  return n >= REVIEW_TEXT[0] && n <= REVIEW_TEXT[1];
}

export function isValidReplyText(text: string): boolean {
  const n = text.trim().length;
  return n >= REPLY_TEXT[0] && n <= REPLY_TEXT[1];
}

/** Gizlilik: yalnızca ad ve soyadın baş harfi ("Ayşe Nur Kaya" -> "Ayşe K."). */
export function authorNameOf(displayName: string | null | undefined): string {
  const parts = (displayName ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'CityJoy';
  const first = parts[0].slice(0, 30);
  return parts.length > 1 ? `${first} ${parts[parts.length - 1][0].toLocaleUpperCase('tr')}.` : first;
}

/** Bir değerlendirme eklenip değişince ya da silinince işletmenin yıldız toplamı ve sayısı. */
export function nextRating(
  current: { sum: number; count: number },
  before: { stars: number; live: boolean } | null,
  after: { stars: number; live: boolean } | null,
): { sum: number; count: number } {
  const stars = (r: { stars: number; live: boolean } | null) => (r?.live ? r.stars : 0);
  const counted = (r: { stars: number; live: boolean } | null) => (r?.live ? 1 : 0);
  return { sum: current.sum - stars(before) + stars(after), count: current.count - counted(before) + counted(after) };
}

export interface ReviewRepository {
  /** Yayındaki son değerlendirmeler (en çok 30). İşletme sahibi ve yazan kişi gizlenenleri de görür. */
  list(businessId: string): Promise<Review[]>;
  getMine(businessId: string, uid: string): Promise<Review | null>;
  /** Kullanıcı bu işletmeyi uygulamadan aradı ya da WhatsApp'tan yazdı mı? */
  hasContacted(businessId: string, uid: string): Promise<boolean>;
  recordContact(businessId: string, uid: string): Promise<void>;
  save(businessId: string, uid: string, input: { stars: number; text: string }, authorName: string): Promise<void>;
  delete(businessId: string, uid: string): Promise<void>;
  reply(businessId: string, reviewUid: string, text: string): Promise<void>;
  report(businessId: string, reviewUid: string, reporterUid: string, reason: ReportReason): Promise<void>;
  /** Hesap silinirken: kullanıcının tüm değerlendirmeleri ve arama kayıtları (KVKK). */
  deleteAllBy(uid: string): Promise<void>;
}
