import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { businessIdFromPurchaser, planOfProduct, PRO_ENTITLEMENT, type PaymentKind } from '@cityjoy/shared';

/**
 * Pro abonelik (Karar Eren, 12 Kasım 2026; PROJE.md 15.2). Satın alma Apple / Google'ın kendi sistemiyle telefonda
 * yapılır; iki mağazayı tek yerden izleyen satın alma servisi (RevenueCat) her olayda buraya bildirim gönderir.
 * Üyelik durumu bildirimdeki bilgiye değil, servisten o an okunan güncel duruma göre yazılır (sıra karışsa da doğru
 * kalır). Ödeme olayları payments/'a olay kimliğiyle yazılır (aynı bildirim iki kez gelse de bir kez sayılır).
 */

/** Servisten okunan güncel abonelik durumu; Pro hiç yoksa null. */
export interface ProState {
  expiresAt: Date | null;
  startedAt: Date | null;
  productId: string;
  store: 'app-store' | 'google-play' | 'web';
  autoRenew: boolean;
}
export type FetchProState = (purchaserId: string) => Promise<ProState | null>;

/** Bildirimin işimize yarayan alanları (RevenueCat webhook "event"). */
interface StoreEvent {
  id?: unknown;
  type?: unknown;
  app_user_id?: unknown;
  original_app_user_id?: unknown;
  aliases?: unknown;
  transferred_from?: unknown;
  transferred_to?: unknown;
  product_id?: unknown;
  store?: unknown;
  environment?: unknown;
  purchased_at_ms?: unknown;
  event_timestamp_ms?: unknown;
  price?: unknown;
  price_in_purchased_currency?: unknown;
  currency?: unknown;
  takehome_percentage?: unknown;
  cancel_reason?: unknown;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : typeof v === 'string' ? [v] : []);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const storeOf = (v: unknown): ProState['store'] => (v === 'PLAY_STORE' ? 'google-play' : v === 'STRIPE' || v === 'RC_BILLING' ? 'web' : 'app-store');

/** Ödeme sayılan olaylar ve türleri; iade müşteri hizmetleri iptalidir (tutar eksi gelir). */
function paymentKind(e: StoreEvent): PaymentKind | null {
  if (e.type === 'INITIAL_PURCHASE' || e.type === 'NON_RENEWING_PURCHASE') return 'ilk';
  if (e.type === 'RENEWAL') return 'yenileme';
  if (e.type === 'CANCELLATION' && e.cancel_reason === 'CUSTOMER_SUPPORT' && num(e.price) < 0) return 'iade';
  return null;
}

/** Bildirimin ilgilendirdiği işletmeler (aktarımda iki taraf da yeniden okunur). */
function businessesOf(e: StoreEvent): string[] {
  const ids = [...strings(e.app_user_id), ...strings(e.original_app_user_id), ...strings(e.aliases), ...strings(e.transferred_from), ...strings(e.transferred_to)];
  return [...new Set(ids.map(businessIdFromPurchaser).filter((x): x is string => !!x))];
}

export async function handleStoreEvent(db: Firestore, body: unknown, deps: { fetchState: FetchProState; now: Date }): Promise<{ synced: number; payment: boolean }> {
  const e = ((body as { event?: StoreEvent } | null)?.event ?? null) as StoreEvent | null;
  if (!e || typeof e.type !== 'string' || e.type === 'TEST') return { synced: 0, payment: false };
  const productId = typeof e.product_id === 'string' ? e.product_id : '';
  // Yalnızca Pro ürünleri; başka ürün (ileride) bu işlevi ilgilendirmez. Aktarımda ürün bilgisi gelmez.
  if (productId && !planOfProduct(productId)) return { synced: 0, payment: false };

  let synced = 0;
  for (const businessId of businessesOf(e)) {
    if (await syncMembership(db, businessId, deps)) synced += 1;
  }

  const kind = paymentKind(e);
  const businessId = businessIdFromPurchaser(typeof e.app_user_id === 'string' ? e.app_user_id : '');
  if (!kind || !businessId || typeof e.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(e.id)) return { synced, payment: false };
  const biz = await db.doc(`businesses/${businessId}`).get();
  const at = Timestamp.fromMillis(num(e.purchased_at_ms) || num(e.event_timestamp_ms) || deps.now.getTime());
  const plan = planOfProduct(productId);
  const takehome = num(e.takehome_percentage);
  await db.doc(`payments/${e.id}`).create({
    businessId,
    businessName: biz.get('name') ?? '',
    ownerUid: biz.get('ownerUid') ?? '',
    provinceCode: biz.get('location.provinceCode') ?? '',
    store: storeOf(e.store),
    productId,
    ...(plan ? { plan } : {}),
    kind,
    amount: num(e.price_in_purchased_currency) * (kind === 'iade' && num(e.price_in_purchased_currency) > 0 ? -1 : 1),
    currency: typeof e.currency === 'string' && /^[A-Z]{3}$/.test(e.currency) ? e.currency : 'USD',
    amountUsd: num(e.price),
    ...(takehome > 0 && takehome <= 1 ? { takehome } : {}),
    at,
    sandbox: e.environment === 'SANDBOX',
    createdAt: FieldValue.serverTimestamp(),
  }).catch((err: { code?: number }) => {
    // Aynı bildirim ikinci kez geldiyse kayıt zaten vardır.
    if (err?.code !== 6) throw err;
  });
  return { synced, payment: true };
}

/** İşletmenin üyeliğini servisteki güncel duruma göre yazar; değiştiyse işlem kaydına ekler. */
export async function syncMembership(db: Firestore, businessId: string, deps: { fetchState: FetchProState; now: Date }): Promise<boolean> {
  const ref = db.doc(`businesses/${businessId}`);
  const biz = await ref.get();
  if (!biz.exists) return false;
  const state = await deps.fetchState(`biz_${businessId}`);
  const prev = (biz.get('membership') ?? {}) as { tier?: string; source?: string; endsAt?: Timestamp };
  const active = !!state && (!state.expiresAt || state.expiresAt > deps.now);
  // Panelden elle verilmiş ve süresi sürmekte olan Pro, mağaza aboneliği yoksa korunur.
  if (!state && prev.source === 'manuel') return false;

  const plan = state ? planOfProduct(state.productId) : undefined;
  const membership = active && state
    ? {
        tier: 'pro',
        ...(state.expiresAt ? { endsAt: Timestamp.fromDate(state.expiresAt) } : {}),
        ...(state.startedAt ? { startedAt: Timestamp.fromDate(state.startedAt) } : {}),
        autoRenew: state.autoRenew,
        source: state.store,
        ...(plan ? { plan } : {}),
      }
    : { tier: 'ucretsiz', ...(state ? { source: state.store, autoRenew: false } : {}) };

  const same = prev.tier === membership.tier && prev.endsAt?.toMillis() === (membership as { endsAt?: Timestamp }).endsAt?.toMillis()
    && (biz.get('membership.autoRenew') ?? null) === ((membership as { autoRenew?: boolean }).autoRenew ?? null);
  if (same) return false;

  const at = Timestamp.fromDate(deps.now);
  const batch = db.batch();
  batch.update(ref, { membership, updatedAt: at });
  if (prev.tier !== membership.tier) {
    batch.set(db.collection('auditLog').doc(), {
      actorUid: 'magaza', module: 'isletme-dogrulama', action: 'duzenle', targetId: businessId, at,
      region: { provinceCode: biz.get('location.provinceCode') ?? '', districtId: biz.get('location.districtId') ?? '' },
      summary: membership.tier === 'pro' ? `Pro abonelik başladı (${biz.get('name') ?? businessId}; ${plan ?? state?.productId ?? ''})` : `Pro abonelik bitti (${biz.get('name') ?? businessId})`,
    });
  }
  await batch.commit();
  return true;
}

/**
 * Günlük: süresi bir günden fazla geçmiş Pro üyelikleri Ücretsiz'e indirir (bildirim gecikse ya da elle verilen 30 günlük
 * Pro bitse bile). Mağaza yenilemesi bildirimle süreyi zaten uzatır.
 */
export async function expireMemberships(db: Firestore, now: Date): Promise<number> {
  const cutoff = Timestamp.fromMillis(now.getTime() - 86_400_000);
  const snap = await db.collection('businesses').where('membership.tier', '==', 'pro').where('membership.endsAt', '<', cutoff).limit(400).get();
  if (snap.empty) return 0;
  const at = Timestamp.fromDate(now);
  const batch = db.batch();
  snap.docs.forEach((d) => {
    batch.update(d.ref, { 'membership.tier': 'ucretsiz', 'membership.autoRenew': false, updatedAt: at });
    batch.set(db.collection('auditLog').doc(), {
      actorUid: 'sure', module: 'isletme-dogrulama', action: 'duzenle', targetId: d.id, at,
      region: { provinceCode: d.get('location.provinceCode') ?? '', districtId: d.get('location.districtId') ?? '' },
      summary: `Pro üyelik süresi doldu (${d.get('name') ?? d.id})`,
    });
  });
  await batch.commit();
  return snap.size;
}

/** RevenueCat REST (v1): işletmenin Pro yetkisi ve aboneliği. Gizli anahtar ortam değişkeninden (Secret Manager). */
export function revenueCatState(apiKey: string): FetchProState {
  return async (purchaserId) => {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(purchaserId)}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`revenuecat ${res.status}`);
    const sub = ((await res.json()) as { subscriber?: Record<string, unknown> }).subscriber ?? {};
    const ent = (sub.entitlements as Record<string, { expires_date?: string | null; purchase_date?: string; product_identifier?: string }> | undefined)?.[PRO_ENTITLEMENT];
    if (!ent?.product_identifier) return null;
    const s = (sub.subscriptions as Record<string, { store?: string; unsubscribe_detected_at?: string | null; original_purchase_date?: string }> | undefined)?.[ent.product_identifier];
    const date = (v?: string | null) => (v ? new Date(v) : null);
    return {
      expiresAt: date(ent.expires_date),
      startedAt: date(s?.original_purchase_date ?? ent.purchase_date),
      productId: ent.product_identifier,
      store: s?.store === 'play_store' ? 'google-play' : s?.store === 'stripe' || s?.store === 'rc_billing' ? 'web' : 'app-store',
      autoRenew: !s?.unsubscribe_detected_at,
    };
  };
}
