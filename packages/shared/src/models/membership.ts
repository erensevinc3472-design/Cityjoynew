/**
 * İşletme üyelik kademesi ve Pro abonelik (PROJE.md 14 madde 2, 15.2).
 *
 * Karar (Eren, 12 Kasım 2026): Pro üyelik ilk sürüme girer, Apple ve Google kurallarına uygun biçimde mağazanın kendi
 * satın alma sistemiyle satılır. "Pro'ya geç" yalnızca doğrulanmış işletmede açıktır. Satın alma telefonda yapılır,
 * mağaza bildirimi sunucuya gelir, üyelik durumu yalnızca sunucuda yazılır (uygulama yalnızca gösterir).
 */
export type MembershipTier = 'ucretsiz' | 'pro';

/** İki kademe (Karar Eren, 3 Kasım 2026; PROJE.md 15 madde 2). Eski kayıtlardaki 'standart' Ücretsiz, 'premium' Pro sayılır. */
export const MEMBERSHIP_TIERS: readonly MembershipTier[] = ['ucretsiz', 'pro'];
export const toTier = (v: unknown): MembershipTier => (v === 'pro' || v === 'premium' ? 'pro' : 'ucretsiz');

/** Üyeliğin nereden geldiği; mağaza ödemeleri sunucuda doğrulanır. */
export type MembershipSource = 'kurucu-donem' | 'app-store' | 'google-play' | 'web' | 'manuel';
export type ProPlan = 'aylik' | 'yillik';
export const PRO_PLANS: readonly ProPlan[] = ['aylik', 'yillik'];

/**
 * Mağazadaki ürün kimlikleri. App Store Connect ve Google Play Console'da bu adlarla abonelik açılır (ikisi aynı
 * abonelik grubunda). Fiyat mağazada belirlenir; uygulama fiyatı mağazadan okur, koda fiyat yazılmaz.
 */
export const PRO_PRODUCTS: Record<ProPlan, string> = { aylik: 'cityjoy_pro_aylik', yillik: 'cityjoy_pro_yillik' };
export const planOfProduct = (productId: string): ProPlan | undefined =>
  // Google Play kimliği "ürün:temel-plan" biçiminde gelebilir.
  PRO_PLANS.find((p) => productId === PRO_PRODUCTS[p] || productId.startsWith(`${PRO_PRODUCTS[p]}:`));
/** Satın alma servisindeki yetki adı (Pro açık mı). */
export const PRO_ENTITLEMENT = 'pro';

/** Satın alma servisinde her işletme ayrı müşteridir: abonelik kişiye değil işletmeye bağlanır. */
export const purchaserIdFor = (businessId: string) => `biz_${businessId}`;
export const businessIdFromPurchaser = (id: string): string | undefined => (/^biz_[A-Za-z0-9_-]{1,128}$/.test(id) ? id.slice(4) : undefined);

/** İşletme kaydındaki üyelik (businesses/{id}.membership). Yalnızca sunucu ve admin yazar. */
export interface BusinessMembership {
  tier: MembershipTier;
  /** ISO tarih; Pro'nun bittiği/yenileneceği an. Ücretsizde boş. */
  endsAt?: string;
  /** ISO tarih; Pro'nun ilk başladığı an. */
  startedAt?: string;
  /** Mağaza aboneliği kendiliğinden yenilenecek mi (sahibi iptal ettiyse false; süre sonuna kadar Pro sürer). */
  autoRenew?: boolean;
  source?: MembershipSource;
  plan?: ProPlan;
}

/** Eski adla uyumluluk. */
export type Membership = BusinessMembership;

export const DEFAULT_MEMBERSHIP: BusinessMembership = { tier: 'ucretsiz' };

/** Pro süresi geçmemiş mi (süresiz manuel Pro'da endsAt yoktur). */
export const isMembershipActive = (m: Pick<BusinessMembership, 'tier' | 'endsAt'>, now: Date) =>
  m.tier === 'pro' && (!m.endsAt || new Date(m.endsAt) > now);

/** "Pro'ya geç" düğmesinin durumu: doğrulanmadan satın alınamaz (Eren, 12 Kasım 2026). */
export type ProOffer = 'dogrulama-gerek' | 'satin-alinabilir' | 'pro';
export function proOffer(b: { verification: { status: string }; membership: Pick<BusinessMembership, 'tier' | 'endsAt'> }, now: Date): ProOffer {
  if (isMembershipActive(b.membership, now)) return 'pro';
  return b.verification.status === 'dogrulandi' ? 'satin-alinabilir' : 'dogrulama-gerek';
}

/** Ödeme kaydının türü. */
export type PaymentKind = 'ilk' | 'yenileme' | 'plan-degisti' | 'iade';
export const PAYMENT_KINDS: readonly PaymentKind[] = ['ilk', 'yenileme', 'plan-degisti', 'iade'];

/**
 * Ödeme kaydı (payments/{id}). Mağaza bildirimiyle sunucu yazar; kimse elle yazamaz. Admin hepsini, işletme sahibi
 * yalnızca kendi işletmesininkileri görür.
 */
export interface Payment {
  id: string;
  businessId: string;
  businessName: string;
  ownerUid: string;
  provinceCode: string;
  store: 'app-store' | 'google-play' | 'web';
  productId: string;
  plan?: ProPlan;
  kind: PaymentKind;
  /** Müşterinin ödediği tutar, ödediği para biriminde (iade eksi). */
  amount: number;
  currency: string;
  /** Aynı tutarın ABD doları karşılığı (mağazalar arası toplam için). */
  amountUsd: number;
  /** Mağaza komisyonu ve vergi düşüldükten sonra kalan oran (0-1); bilinmiyorsa boş. */
  takehome?: number;
  /** ISO tarih. */
  at: string;
  /** Deneme ödemeleri (sandbox) gelire sayılmaz. */
  sandbox: boolean;
}

export interface RevenueSummary {
  /** Bu ay (yerel saat) alınan, para birimine göre. */
  thisMonth: Record<string, number>;
  /** Geçen ay. */
  lastMonth: Record<string, number>;
  /** Mağaza payı düşülünce bu ay tahmini net (ABD doları). */
  thisMonthNetUsd: number;
  /** Son 12 ay, eskiden yeniye: { ay: 'YYYY-MM', para birimine göre tutar, ödeme sayısı }. */
  months: { month: string; totals: Record<string, number>; count: number }[];
  newThisMonth: number;
  renewalsThisMonth: number;
  refundsThisMonth: number;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const add = (r: Record<string, number>, cur: string, n: number) => {
  r[cur] = Math.round(((r[cur] ?? 0) + n) * 100) / 100;
};

/** Panelin gelir özeti. Deneme ödemeleri sayılmaz. */
export function summarizeRevenue(payments: readonly Payment[], now: Date): RevenueSummary {
  const months: RevenueSummary['months'] = [];
  for (let i = 11; i >= 0; i--) months.push({ month: monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)), totals: {}, count: 0 });
  const thisKey = monthKey(now);
  const lastKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const s: RevenueSummary = { thisMonth: {}, lastMonth: {}, thisMonthNetUsd: 0, months, newThisMonth: 0, renewalsThisMonth: 0, refundsThisMonth: 0 };
  for (const p of payments) {
    if (p.sandbox) continue;
    const key = monthKey(new Date(p.at));
    const m = months.find((x) => x.month === key);
    if (m) {
      add(m.totals, p.currency, p.amount);
      m.count += 1;
    }
    if (key === lastKey) add(s.lastMonth, p.currency, p.amount);
    if (key !== thisKey) continue;
    add(s.thisMonth, p.currency, p.amount);
    s.thisMonthNetUsd = Math.round((s.thisMonthNetUsd + p.amountUsd * (p.takehome ?? 0.85)) * 100) / 100;
    if (p.kind === 'ilk') s.newThisMonth += 1;
    else if (p.kind === 'yenileme') s.renewalsThisMonth += 1;
    else if (p.kind === 'iade') s.refundsThisMonth += 1;
  }
  return s;
}

/** Para tutarını Türkçe gösterir: "1.250,00 ₺", "9,99 USD". */
export function formatMoney(amount: number, currency: string, locale = 'tr-TR'): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
