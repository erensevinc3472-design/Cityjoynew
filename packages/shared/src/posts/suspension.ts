/**
 * Hesap askıya alma (Eren, 12 Kasım 2026: "Askıya alma olsun, profili de askıya alınsın, giriş yapmaya çalışınca
 * askıya alınmıştır desin"). Kalıcı silme yok; askı her zaman kaldırılabilir. Yalnızca admin, sunucu işleviyle yapar:
 * giriş kapatılır (açık oturumlar da düşer), profil "askıya alınmış" görünür, işlem kayda geçer. Süreli askı süresi
 * dolunca sunucu kendiliğinden kaldırır.
 */
export const SUSPENSION_REASONS = ['uygunsuz-icerik', 'taciz', 'spam', 'sahte-hesap', 'yasa-disi', 'diger'] as const;
export type SuspensionReason = (typeof SUSPENSION_REASONS)[number];

/** Süre seçenekleri (gün); null süresiz. */
export const SUSPENSION_DAYS = [1, 7, 30, null] as const;
export type SuspensionDays = (typeof SUSPENSION_DAYS)[number];

export const SUSPENSION_NOTE_MAX = 300;

export interface SuspendRequest {
  uid: string;
  reason: SuspensionReason;
  days: SuspensionDays;
  /** Yalnızca yöneticilerin göreceği kısa not. */
  note?: string;
}

export interface Suspension {
  uid: string;
  displayName: string;
  reason: SuspensionReason;
  note: string;
  active: boolean;
  /** Süreli askının bitişi (ISO); süresizse yok. */
  until?: string;
  at: string;
  by: string;
}

/** İstek geçerli mi (sunucu da aynı denetimi yapar). */
export function validSuspendRequest(r: unknown): r is SuspendRequest {
  if (!r || typeof r !== 'object') return false;
  const x = r as Record<string, unknown>;
  return (
    typeof x.uid === 'string' && x.uid.length > 0 && x.uid.length <= 128 &&
    (SUSPENSION_REASONS as readonly unknown[]).includes(x.reason) &&
    (SUSPENSION_DAYS as readonly unknown[]).includes(x.days ?? null) &&
    (x.note === undefined || (typeof x.note === 'string' && x.note.length <= SUSPENSION_NOTE_MAX))
  );
}

/**
 * İşletme askıya alma (Eren, 12 Kasım 2026: "işletme hesabını askıya alabilir miyim; hangi hesaba bağlıysa o hesap
 * işletme açamasın"). Yalnızca admin, sunucu işleviyle: işletme herkesten gizlenir, sahibi ve yetkilileri açamaz,
 * düzenleyemez, işletme adına paylaşamaz. İstenirse (varsayılan) sahibi askı süresince yeni işletme açamaz. Aynı
 * telefonla ikinci işletme zaten açılamaz (telefon kaydı askıdaki işletmede kalır).
 */
export interface BusinessSuspendRequest {
  businessId: string;
  reason: SuspensionReason;
  days: SuspensionDays;
  note?: string;
  /** Sahibi askı süresince yeni işletme açamasın. */
  banOwner: boolean;
}

export interface BusinessSuspension {
  businessId: string;
  name: string;
  ownerUid: string;
  reason: SuspensionReason;
  note: string;
  banOwner: boolean;
  active: boolean;
  until?: string;
  at: string;
  by: string;
}

export function validBusinessSuspendRequest(r: unknown): r is BusinessSuspendRequest {
  if (!r || typeof r !== 'object') return false;
  const x = r as Record<string, unknown>;
  return (
    typeof x.businessId === 'string' && x.businessId.length > 0 && x.businessId.length <= 128 &&
    typeof x.banOwner === 'boolean' &&
    validSuspendRequest({ uid: x.businessId, reason: x.reason, days: x.days, note: x.note })
  );
}
