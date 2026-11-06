/**
 * Harcama sigortası (Eren, 6-7 Kasım 2026). Google Cloud bütçesi (aylık, TL) her güncellemede sunucuya bildirir;
 * o ayın harcaması sigorta tutarına ulaşınca projenin ödeme hesabı bağlantısı koparılır (ücretli servisler durur).
 * Sigorta tutarını admin Panel > Harcama'dan değiştirir; boşsa bütçenin iki katı. Yeniden açmayı yalnızca hesap
 * sahibi Google Cloud'dan yapabilir (bağlantı kopunca sunucu da durur).
 */

/** Panelden girilebilecek sigorta tutarı aralığı (TL). */
export const BILLING_CAP_RANGE = [100, 100_000] as const;
/** Google Cloud'da bu projenin ödeme hesaplarını bağlama / yeniden açma sayfası. */
export const BILLING_PROJECTS_URL = 'https://console.cloud.google.com/billing/projects';

/** `billing/status`: yalnızca sunucu yazar, admin okur. */
export interface BillingStatus {
  /** Bu ayın tahmini harcaması (Google'ın son bildirimi). */
  costAmount: number;
  budgetAmount: number;
  currency: string;
  /** Sigortanın atacağı tutar. */
  capAmount: number;
  /** Ödeme bağlantısı açık mı (sunucunun son bildiği). */
  enabled: boolean;
  stoppedBy?: 'sigorta' | 'panel';
  stoppedAt?: string;
  updatedAt?: string;
}

/** Sigorta tutarı: admin girdiyse o, yoksa bütçenin iki katı. */
export function capFor(budgetAmount: number, cap?: number | null): number {
  if (typeof cap === 'number' && Number.isFinite(cap) && cap > 0) return cap;
  return Number.isFinite(budgetAmount) && budgetAmount > 0 ? budgetAmount * 2 : 0;
}

/** Panelde girilen tutar geçerli mi (tam sayı, aralıkta). */
export const validCap = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= BILLING_CAP_RANGE[0] && v <= BILLING_CAP_RANGE[1];
