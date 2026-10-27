/**
 * İşletme üyelik kademesi. Ödeme sistemi ilk sürümde yoktur (PROJE.md 15.2), ama alanlar
 * baştan veri yapısında durur; ödeme eklenince yalnızca bu kayıt güncellenir.
 */
export type MembershipTier = 'ucretsiz' | 'standart' | 'pro' | 'premium';

export interface Membership {
  tier: MembershipTier;
  /** ISO tarih. */
  startsAt: string;
  /** ISO tarih; ücretsiz kademede boş. */
  endsAt?: string;
  autoRenew: boolean;
  /** Durumun nereden geldiği; mağaza ve web ödemeleri sunucuda doğrulanır. */
  source: 'kurucu-donem' | 'app-store' | 'google-play' | 'web' | 'manuel';
}

export const DEFAULT_MEMBERSHIP: Omit<Membership, 'startsAt'> = {
  tier: 'ucretsiz',
  autoRenew: false,
  source: 'kurucu-donem',
};
