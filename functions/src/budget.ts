/**
 * Harcama sigortası (Eren istedi, 6 Kasım 2026). Google Cloud bütçe uyarısı yalnızca e-posta atar, harcamayı durdurmaz.
 * Bütçe (Faturalandırma > Bütçeler, "cityjoy", aylık) her güncellemede `budget-alerts` konusuna bildirim yollar;
 * o ayın harcaması bütçenin SIGORTA_KATI katına ulaşırsa projenin ödeme hesabı bağlantısı koparılır: ücretli
 * servisler durur, karttan sürpriz tutar çekilmez. Yeniden açmak için Eren Google Cloud > Faturalandırma > Projelerim'den
 * cityjoynew'i yeniden "Firebase Payment" hesabına bağlar.
 */
import { applicationDefault } from 'firebase-admin/app';

/** Bütçe 350 TL (yaklaşık 10 $); sigorta iki katında, yaklaşık 20 $. */
export const SIGORTA_KATI = 2;

/** Google'ın bütçe bildirimindeki alanlar (https://cloud.google.com/billing/docs/how-to/budgets-programmatic-notifications). */
export interface BudgetNotice {
  costAmount?: number;
  budgetAmount?: number;
  currencyCode?: string;
  budgetDisplayName?: string;
}

export type DisableBilling = () => Promise<void>;

/** Sigortanın atması gerekiyor mu? Bütçe tutarı yoksa ya da bozuksa hiçbir şey yapılmaz. */
export function overCap(n: BudgetNotice, factor = SIGORTA_KATI): boolean {
  const cost = Number(n.costAmount);
  const budget = Number(n.budgetAmount);
  if (!Number.isFinite(cost) || !Number.isFinite(budget) || budget <= 0) return false;
  return cost >= budget * factor;
}

/** Bildirimi işler; sigorta attıysa true döner. */
export async function handleBudgetNotice(n: BudgetNotice, disable: DisableBilling): Promise<boolean> {
  if (!overCap(n)) return false;
  await disable();
  return true;
}

/** Projenin ödeme hesabı bağlantısını koparır (Cloud Billing API; işlevin hizmet hesabı "Billing Project Manager" olmalı). */
export const cloudBillingDisabler =
  (projectId: string): DisableBilling =>
  async () => {
    const { access_token } = await applicationDefault().getAccessToken();
    const url = `https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`;
    const info = (await (await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } })).json()) as { billingEnabled?: boolean };
    if (info.billingEnabled === false) return;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ billingAccountName: '' }),
    });
    if (!res.ok) throw new Error(`billing ${res.status}: ${await res.text()}`);
  };
