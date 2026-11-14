import type { Photo } from '../media/photo';
import type { LocationBadge } from '../locations/location-badge';

/**
 * Keşfet profili, takip ve engelleme (PROJE.md 5.5, 5.8). Herkese açık profil yalnızca "Ayşe K." biçimindeki adı,
 * kısa tanıtımı ve gizli hesap bilgisini taşır; yaş, cinsiyet, meslek ve mahalle gösterilmez (Eren'in kararı).
 * Gizli hesapta takip isteği onaylanınca takip başlar (13-17 yaş varsayılan gizli). Engellenen kişi engelleyeni takip
 * edemez, gönderilerine yorum yazamaz; engelleyen onun gönderilerini ve yorumlarını görmez.
 */

export interface PublicProfile {
  uid: string;
  /** "Ayşe K." biçiminde. */
  displayName: string;
  bio: string;
  isPrivate: boolean;
  /** Moderatör tanıtımı kaldırdı. */
  bioRemoved: boolean;
  /** Profil fotoğrafı (kare, yuvarlak gösterilir); yoksa adın baş harfi. */
  photo?: Photo;
  /** Moderatör fotoğrafı kaldırdı; kişi yenisini koyamaz. */
  photoRemoved: boolean;
  /** Konum rozeti (madde 5): mahallesi ya da ilçesi telefonun konumuyla doğrulandı; mahallenin adı görünmez. */
  locationVerified?: LocationBadge;
  /** Hesap askıya alındı (yalnızca sunucu koyar): profil ve gönderiler başkalarına gösterilmez. */
  suspended?: boolean;
  /** Admin'in verdiği rozetlerin kimlikleri (posts/badges.ts); kişi kendisi değiştiremez. */
  badges?: string[];
  /** Yayıncı rozeti var: Haberler'e paylaşabilir (yalnızca admin rozet verirken yazılır). */
  publisher?: boolean;
  /**
   * Resmî CityJoy hesabı (Eren, 14 Kasım 2026): adın yanında altın onay rozeti; istediği yere (tüm Türkiye, il, ilçe,
   * mahalle) paylaşır, Haberler'e de paylaşabilir. Yalnızca admin panelden verir; kişi kendisi yazamaz (kurallar).
   */
  official?: boolean;
}

export const PROFILE_LIMITS = {
  bio: 160,
  /** Takip akışında en çok bu kadar hesabın gönderisi okunur (hesap başına bir sorgu). */
  feedAuthors: 30,
  /** Takip akışında hesap başına okunan gönderi (maliyet: 13 Kasım 2026'da 10'dan 5'e; akış zaten en yenileri gösterir). */
  perAuthor: 5,
  /** Ara > Kişiler: tek sorguda en çok. */
  searchResults: 30,
  /** Takipçi / Takip listesi: sayfa başına kişi (aşağı kaydırdıkça devamı; 14 Kasım 2026). */
  followPage: 30,
} as const;

/** Takipçi / Takip listesinde bir sayfa: kişiler ve devamı için imleç (null: bitti). */
export interface FollowPage<T> {
  items: T[];
  next: string | null;
}

export type FollowStatus = 'aktif' | 'istek';

export interface Follow {
  followerUid: string;
  followeeUid: string;
  status: FollowStatus;
  createdAt: string;
}

export const PROFILE_REPORT_REASONS = ['taklit', 'nefret', 'taciz', 'spam', 'uygunsuz', 'diger'] as const;
export type ProfileReportReason = (typeof PROFILE_REPORT_REASONS)[number];

export const validateBio = (bio: string) => bio.trim().length <= PROFILE_LIMITS.bio;

/** Takip belgesinin kimliği: "takipEden_takipEdilen". */
export const followId = (followerUid: string, followeeUid: string) => `${followerUid}_${followeeUid}`;
export const blockId = (blockerUid: string, blockedUid: string) => `${blockerUid}_${blockedUid}`;
