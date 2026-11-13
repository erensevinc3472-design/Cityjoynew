import { collection, doc, documentId, getDoc, getDocs, query, serverTimestamp, where, writeBatch, type Firestore } from './metered';
import { httpsCallable, type Functions } from 'firebase/functions';

import { validCap, type BillingStatus } from '../billing/billing';
import { costDayKey, type CostDay } from '../billing/cost';
import { addAudit, iso } from './grants';

/** Panel > Harcama (yalnızca admin): durum, sigorta tutarı, "Şimdi durdur". */
export function createBillingAdmin(db: Firestore, functions: Functions) {
  return {
    async status(): Promise<BillingStatus | null> {
      const s = await getDoc(doc(db, 'billing', 'status'));
      if (!s.exists()) return null;
      const d = s.data();
      return {
        costAmount: Number(d.costAmount) || 0,
        budgetAmount: Number(d.budgetAmount) || 0,
        currency: String(d.currency ?? 'TRY'),
        capAmount: Number(d.capAmount) || 0,
        enabled: d.enabled !== false,
        stoppedBy: d.stoppedBy,
        stoppedAt: iso(d.stoppedAt),
        updatedAt: iso(d.updatedAt),
      };
    },
    async cap(): Promise<number | null> {
      const s = await getDoc(doc(db, 'billing', 'settings'));
      const v = s.exists() ? s.get('cap') : null;
      return typeof v === 'number' ? v : null;
    },
    async saveCap(actorUid: string, cap: number): Promise<void> {
      if (!validCap(cap)) throw new Error('gecersiz');
      const batch = writeBatch(db);
      batch.set(doc(db, 'billing', 'settings'), { cap, updatedBy: actorUid, updatedAt: serverTimestamp() });
      addAudit(db, batch, { actorUid, module: 'moderasyon', action: 'duzenle', targetId: 'billing', summary: `Harcama sigortası ${cap} TL yapıldı` });
      await batch.commit();
    },
    /** Ödeme bağlantısını hemen koparır (sunucu admin olduğunu denetler, işlem kaydına yazar). */
    /** Özelliklere göre harcama: son `days` günün kayıtları (gün başına bir okuma). */
    async costDays(days: number, now = new Date()): Promise<CostDay[]> {
      const from = costDayKey(new Date(now.getTime() - days * 86400_000));
      const snap = await getDocs(query(collection(db, 'billing'), where(documentId(), '>=', `cost-${from}`), where(documentId(), '<', 'cost-~')));
      return snap.docs.map((d) => ({ ...(d.data() as CostDay), day: d.id.slice(5) }));
    },
    async stopNow(): Promise<boolean> {
      const stop = httpsCallable<Record<string, never>, { stopped: boolean }>(functions, 'billingStop');
      return (await stop({})).data.stopped;
    },
  };
}
