import { Linking, Platform } from 'react-native';
import { PRO_PLANS, PRO_PRODUCTS, purchaserIdFor, type ProPlan } from '@cityjoy/shared';

/**
 * Pro abonelik satın alma (Karar Eren, 12 Kasım 2026; PROJE.md 15.2). Apple ve Google'ın kendi satın alma sistemi
 * kullanılır; iki mağazayı tek yerden yöneten servis RevenueCat'tir. Telefon yalnızca satın almayı başlatır, üyeliği
 * sunucu mağaza bildirimiyle açar (uygulama kendi kendine Pro yazamaz). Fiyatlar mağazadan okunur (her ülkede kendi
 * para biriminde); koda fiyat yazılmaz. Anahtarlar yoksa (geliştirme, Expo Go) ekran "yakında" gösterir.
 */
const KEY = Platform.select({ ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY, android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY }) ?? '';
export const purchasesAvailable = Platform.OS !== 'web' && !!KEY;

type Sdk = typeof import('react-native-purchases').default;
let sdk: Promise<Sdk> | null = null;
/** Kütüphane yalnızca gerektiğinde yüklenir (web'de ve anahtarsız hiç yüklenmez). */
function load(): Promise<Sdk> {
  if (!sdk) {
    sdk = import('react-native-purchases').then((m) => {
      m.default.configure({ apiKey: KEY });
      return m.default;
    });
  }
  return sdk;
}

export type TrialUnit = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
const UNITS: readonly string[] = ['DAY', 'WEEK', 'MONTH', 'YEAR'];

export interface PlanOffer {
  plan: ProPlan;
  /** Mağazanın yazdığı fiyat, örn. "349,99 ₺". */
  price: string;
  /** Yıllıkta aylık karşılığı, örn. "29,17 ₺". */
  perMonth?: string;
  /** Mağazada tanımlı ücretsiz deneme (Karar Eren, 12 Kasım 2026: açılışta ilk ay ücretsiz). */
  trial?: { count: number; unit: TrialUnit };
  pkg: unknown;
}

/** İşletmeye ait müşteri olarak oturum açar ve mağazadaki Pro planlarını getirir. */
export async function loadOffers(businessId: string): Promise<PlanOffer[]> {
  if (!purchasesAvailable) return [];
  const p = await load();
  await p.logIn(purchaserIdFor(businessId));
  const offerings = await p.getOfferings();
  const pkgs = offerings.current?.availablePackages ?? [];
  return PRO_PLANS.flatMap((plan) => {
    const pkg = pkgs.find((x) => x.product.identifier === PRO_PRODUCTS[plan] || x.product.identifier.startsWith(`${PRO_PRODUCTS[plan]}:`));
    if (!pkg) return [];
    const intro = pkg.product.introPrice;
    const trial = intro && intro.price === 0 && UNITS.includes(intro.periodUnit) ? { count: Math.max(1, intro.periodNumberOfUnits * intro.cycles), unit: intro.periodUnit as TrialUnit } : undefined;
    return [{ plan, price: pkg.product.priceString, perMonth: plan === 'yillik' ? (pkg.product.pricePerMonthString ?? undefined) : undefined, ...(trial ? { trial } : {}), pkg }];
  });
}

export type BuyResult = 'tamam' | 'vazgecildi';

/** Satın alma penceresini açar (Face ID / parmak izi mağazanın kendi penceresinde). */
export async function buy(offer: PlanOffer): Promise<BuyResult> {
  const p = await load();
  try {
    await p.purchasePackage(offer.pkg as Parameters<Sdk['purchasePackage']>[0]);
    return 'tamam';
  } catch (e) {
    if ((e as { userCancelled?: boolean | null }).userCancelled) return 'vazgecildi';
    throw e;
  }
}

/** Telefon değişince ya da yeniden kurulunca önceki satın almayı bu işletmeye geri bağlar. */
export async function restore(businessId: string): Promise<void> {
  const p = await load();
  await p.logIn(purchaserIdFor(businessId));
  await p.restorePurchases();
}

/** Aboneliği iptal etme / planı değiştirme mağazanın kendi sayfasında yapılır. */
export async function manageSubscription(source?: string): Promise<void> {
  if (purchasesAvailable) {
    try {
      await (await load()).showManageSubscriptions();
      return;
    } catch {
      // Aşağıdaki bağlantıya düşer.
    }
  }
  const url = source === 'google-play' || Platform.OS === 'android' ? 'https://play.google.com/store/account/subscriptions' : 'https://apps.apple.com/account/subscriptions';
  await Linking.openURL(url);
}
