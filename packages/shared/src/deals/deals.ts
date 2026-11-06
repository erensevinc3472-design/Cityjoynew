/**
 * Fırsatlar (PROJE.md 13. madde 35, Sosyal Harmoni > Fırsatlar; Karar Eren, 3 Kasım 2026). Yalnızca doğrulanmış işletme
 * fırsat açar; işletme Profil > İşletmem > Fırsatlarım'dan yönetir. Fırsata dokununca işletmenin kendi sayfası açılır
 * (ayrı fırsat sayfası yok), fırsat kutusu kapağın altındadır. Bitiş tarihi zorunlu, en çok 90 gün; bitince kendiliğinden
 * listeden kalkar. Şart değişirse "güncellendi" yazar. Aynı anda açık fırsat: Ücretsiz 1, Pro 5.
 */

import type { MembershipTier } from '../models/membership';

/** Sosyal Harmoni > Fırsatlar kartlarıyla aynı sıra (dil anahtarı social.deals.{key}). */
export const DEAL_CATEGORIES = ['food', 'market', 'sport', 'fun', 'craft', 'health', 'education'] as const;
export type DealCategory = (typeof DEAL_CATEGORIES)[number];

/** Yüzde indirim, tutar indirimi, hediye (ör. "2. kahve bizden"), özel fiyat. */
export const DEAL_KINDS = ['yuzde', 'tutar', 'hediye', 'ozel-fiyat'] as const;
export type DealKind = (typeof DEAL_KINDS)[number];

/** Kullanım: kasada kod söylenir ya da ekran gösterilir. */
export const DEAL_USAGES = ['kod', 'ekran'] as const;
export type DealUsage = (typeof DEAL_USAGES)[number];

/** gizlendi: il yöneticisi ya da admin kaldırdı (işletme açamaz). */
export type DealStatus = 'aktif' | 'durduruldu' | 'bitti' | 'gizlendi';

export const DEAL_REPORT_REASONS = ['yaniltici', 'gecersiz', 'uygunsuz', 'diger'] as const;
export type DealReportReason = (typeof DEAL_REPORT_REASONS)[number];

export const DEAL_LIMITS = {
  /** "%20", "50 TL", "1 alana 1 bedava" gibi kısa oran / değer. */
  value: [1, 24],
  /** Neyde geçerli ("Tüm kahvaltı menüsü"). */
  title: [3, 80],
  terms: [0, 400],
  when: [0, 80],
  code: [3, 16],
  /** Bitiş tarihi bugünden en çok bu kadar gün sonra. */
  maxDays: 90,
  /** Aynı anda açık fırsat sayısı kademeye göre (Karar Eren, 3 Kasım 2026). */
  activeFree: 1,
  activePro: 5,
} as const;

export interface DealInput {
  businessId: string;
  category: DealCategory;
  kind: DealKind;
  value: string;
  title: string;
  /** Gün / saat ("Hafta içi 12:00-15:00"); boşsa her zaman. */
  when?: string;
  terms?: string;
  usage: DealUsage;
  /** Kullanım "kod" ise kasada söylenecek kod. */
  code?: string;
  /** Son geçerlilik günü (YYYY-AA-GG, o günün sonuna kadar). */
  endsOn: string;
}

export interface DealStats {
  views: number;
  codeViews: number;
  calls: number;
}

export interface Deal extends DealInput {
  id: string;
  /** İşletmeden kopyalanır: liste sorgusu ve kart için. */
  businessName: string;
  provinceCode: string;
  districtId?: string;
  ownerUid: string;
  status: DealStatus;
  /** Yalnızca Pro işletmede "Sponsorlu" öne çıkma (panelden; şimdilik ödeme yok). */
  sponsored?: boolean;
  stats: DealStats;
  reportCount: number;
  /** Şartlar ya da değer yayından sonra değiştiyse (ISO); kutuda "güncellendi" yazar. */
  changedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type DealError = 'category' | 'kind' | 'value' | 'title' | 'when' | 'terms' | 'usage' | 'code' | 'endsOn';

const DAY_MS = 86_400_000;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Bitiş için seçilebilecek en geç gün (bugün + 90). Sunucu kuralı günü UTC gece yarısı sayar; Türkiye saatiyle 00.00-03.00
 * arasında yerel tarih bir gün ileride olduğundan en geç gün UTC tarihinden alınır (yoksa sunucu reddeder).
 */
export const latestDealEnd = (now = new Date()) => new Date(now.getTime() + DEAL_LIMITS.maxDays * DAY_MS).toISOString().slice(0, 10);
export const todayYmd = (now = new Date()) => ymd(now);

const within = (s: string | undefined, [min, max]: readonly [number, number]) => {
  const n = (s ?? '').trim().length;
  return n >= min && n <= max;
};

export function validateDeal(d: DealInput, now = new Date()): DealError[] {
  const e: DealError[] = [];
  if (!DEAL_CATEGORIES.includes(d.category)) e.push('category');
  if (!DEAL_KINDS.includes(d.kind)) e.push('kind');
  if (!within(d.value, DEAL_LIMITS.value)) e.push('value');
  if (!within(d.title, DEAL_LIMITS.title)) e.push('title');
  if (!within(d.when, DEAL_LIMITS.when)) e.push('when');
  if (!within(d.terms, DEAL_LIMITS.terms)) e.push('terms');
  if (!DEAL_USAGES.includes(d.usage)) e.push('usage');
  if (d.usage === 'kod' && !/^[A-Za-z0-9-]{3,16}$/.test(d.code ?? '')) e.push('code');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.endsOn) || d.endsOn < todayYmd(now) || d.endsOn > latestDealEnd(now)) e.push('endsOn');
  return e;
}

/** Bitiş günü geçti mi (o günün sonuna kadar geçerli). */
export const dealExpired = (d: Pick<Deal, 'endsOn'>, now = new Date()) => d.endsOn < todayYmd(now);

/** Listede görünür mü: açık ve süresi dolmamış. */
export const dealLive = (d: Pick<Deal, 'status' | 'endsOn'>, now = new Date()) => d.status === 'aktif' && !dealExpired(d, now);

/** Kalan gün (bugün biterse 0). */
export const dealDaysLeft = (d: Pick<Deal, 'endsOn'>, now = new Date()) =>
  Math.max(0, Math.round((new Date(`${d.endsOn}T00:00:00`).getTime() - new Date(`${todayYmd(now)}T00:00:00`).getTime()) / DAY_MS));

export const activeDealLimit = (tier: MembershipTier) => (tier === 'pro' ? DEAL_LIMITS.activePro : DEAL_LIMITS.activeFree);

/** Sponsorlu önce, sonra en yakın bitiş (süresi azalan fırsat önde), sonra en yeni. */
export const sortDeals = (list: Deal[]) =>
  [...list].sort((a, b) => Number(!!b.sponsored) - Number(!!a.sponsored) || a.endsOn.localeCompare(b.endsOn) || b.createdAt.localeCompare(a.createdAt));

/** İşletme türünden önerilen fırsat kategorisi (formda ilk seçim). */
export function suggestDealCategory(type: string): DealCategory {
  if (type === 'yeme-icme') return 'food';
  if (type === 'esnaf' || type === 'evden-uretim') return 'craft';
  return 'craft';
}
