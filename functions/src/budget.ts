/**
 * Harcama sigortası (Eren istedi, 6-7 Kasım 2026). Google Cloud bütçe uyarısı yalnızca e-posta atar, harcamayı
 * durdurmaz. Bütçe (Faturalandırma > Bütçeler, "cityjoy", aylık) her güncellemede `budget-alerts` konusuna bildirim
 * yollar; o ayın harcaması sigorta tutarına (Panel > Harcama; boşsa bütçenin iki katı) ulaşırsa projenin ödeme hesabı
 * bağlantısı koparılır: ücretli servisler durur, karttan sürpriz tutar çekilmez. Son durum `billing/status`'a yazılır
 * (yalnızca admin okur). Yeniden açmak için Eren Google Cloud > Faturalandırma > Projelerim'den cityjoynew'i yeniden
 * "Firebase Payment" hesabına bağlar (bağlantı kopukken sunucu çalışmaz, panelden açılamaz).
 */
import { applicationDefault } from 'firebase-admin/app';
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { capFor } from '@cityjoy/shared';

/** Google'ın bütçe bildirimindeki alanlar (https://cloud.google.com/billing/docs/how-to/budgets-programmatic-notifications). */
export interface BudgetNotice {
  costAmount?: number;
  budgetAmount?: number;
  currencyCode?: string;
  budgetDisplayName?: string;
}

export type DisableBilling = () => Promise<void>;

/** Bildirim geçerli mi; geçerliyse harcama ve bütçe. */
function amounts(n: BudgetNotice): { cost: number; budget: number } | null {
  const cost = Number(n.costAmount);
  const budget = Number(n.budgetAmount);
  return Number.isFinite(cost) && Number.isFinite(budget) && budget > 0 ? { cost, budget } : null;
}

/**
 * Bildirimi işler: durumu yazar, harcama sigorta tutarına ulaştıysa bağlantıyı koparır. Sigorta attıysa true.
 */
export async function handleBudgetNotice(db: Firestore, n: BudgetNotice, disable: DisableBilling, now: Date): Promise<boolean> {
  const a = amounts(n);
  if (!a) return false;
  const settings = await db.doc('billing/settings').get();
  const capAmount = capFor(a.budget, settings.exists ? (settings.get('cap') as number) : null);
  const status = db.doc('billing/status');
  const base = { costAmount: a.cost, budgetAmount: a.budget, currency: n.currencyCode ?? '', capAmount, updatedAt: Timestamp.fromDate(now) };
  if (a.cost < capAmount) {
    await status.set({ ...base, enabled: true, stoppedBy: FieldValue.delete(), stoppedAt: FieldValue.delete() }, { merge: true });
    return false;
  }
  await disable();
  await status.set({ ...base, enabled: false, stoppedBy: 'sigorta', stoppedAt: Timestamp.fromDate(now) }, { merge: true });
  return true;
}

/** Panel > Harcama > "Şimdi durdur": yalnızca admin; işlem kaydına yazılır. */
export async function handleManualStop(db: Firestore, uid: string, disable: DisableBilling, now: Date): Promise<void> {
  if (!(await db.doc(`admins/${uid}`).get()).exists) throw new Error('yetki');
  await disable();
  const at = Timestamp.fromDate(now);
  const batch = db.batch();
  batch.set(db.doc('billing/status'), { enabled: false, stoppedBy: 'panel', stoppedAt: at, updatedAt: at }, { merge: true });
  batch.set(db.collection('auditLog').doc(), {
    actorUid: uid,
    module: 'moderasyon',
    action: 'duzenle',
    targetId: 'billing',
    at,
    summary: 'Ödeme bağlantısı panelden koparıldı (ücretli servisler durdu)',
  });
  await batch.commit();
}

/** Projenin ödeme hesabı bağlantısını koparır (Cloud Billing API; işlevin hizmet hesabı "Project Billing Manager" olmalı). */
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
