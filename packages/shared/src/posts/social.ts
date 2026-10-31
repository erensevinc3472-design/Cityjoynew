import type { Photo } from '../media/photo';

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
}

export const PROFILE_LIMITS = {
  bio: 160,
  /** Takip akışında en çok bu kadar hesabın gönderisi okunur (hesap başına bir sorgu). */
  feedAuthors: 30,
  /** Takip akışında hesap başına okunan gönderi. */
  perAuthor: 10,
  /** Ara > Kişiler: tek sorguda en çok. */
  searchResults: 30,
} as const;

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
