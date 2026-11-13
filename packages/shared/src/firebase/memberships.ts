import { httpsCallable, type Functions } from 'firebase/functions';
import { collection, getDocs, limit, orderBy, query, Timestamp, where, type DocumentData, type Firestore } from './metered';

import { PAYMENT_KINDS, type BusinessMembership, type Payment, type PaymentKind } from '../models/membership';
import { membershipFrom } from './businesses';
import { iso } from './grants';

function paymentFrom(id: string, d: DocumentData): Payment {
  const kind: PaymentKind = PAYMENT_KINDS.includes(d.kind) ? d.kind : 'ilk';
  return {
    id,
    businessId: String(d.businessId ?? ''),
    businessName: String(d.businessName ?? ''),
    ownerUid: String(d.ownerUid ?? ''),
    provinceCode: String(d.provinceCode ?? ''),
    store: d.store === 'google-play' || d.store === 'web' ? d.store : 'app-store',
    productId: String(d.productId ?? ''),
    ...(d.plan === 'aylik' || d.plan === 'yillik' ? { plan: d.plan } : {}),
    kind,
    amount: Number(d.amount) || 0,
    currency: String(d.currency ?? 'TRY'),
    amountUsd: Number(d.amountUsd) || 0,
    ...(typeof d.takehome === 'number' ? { takehome: d.takehome } : {}),
    at: iso(d.at) ?? new Date(0).toISOString(),
    sandbox: d.sandbox === true,
  };
}

export interface ProBusinessRow {
  id: string;
  name: string;
  provinceCode: string;
  membership: BusinessMembership;
}

/** Panel > Üyelikler ve Gelir (yalnızca admin; kurallar da yalnızca admine okutur). */
export function createMembershipAdmin(db: Firestore) {
  return {
    /** Son 13 ayın ödemeleri (12 aylık tablo ve geçen ay için), yeniden eskiye. */
    async payments(now: Date, max = 2000): Promise<Payment[]> {
      const since = Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() - 12, 1));
      const snap = await getDocs(query(collection(db, 'payments'), where('at', '>=', since), orderBy('at', 'desc'), limit(max)));
      return snap.docs.map((d) => paymentFrom(d.id, d.data()));
    },
    /** Pro kademesindeki işletmeler (süresi dolanlar günlük temizlikte Ücretsiz'e iner). */
    async proBusinesses(max = 1000): Promise<ProBusinessRow[]> {
      const snap = await getDocs(query(collection(db, 'businesses'), where('membership.tier', '==', 'pro'), limit(max)));
      return snap.docs.map((d) => {
        const x = d.data();
        return { id: d.id, name: String(x.name ?? ''), provinceCode: String(x.location?.provinceCode ?? ''), membership: membershipFrom(x.membership) };
      });
    },
  };
}

/** İşletme sahibinin "Üyelik ve Ödemeler" ekranı: yalnızca kendi işletmesinin ödemeleri. */
export function createOwnerPayments(db: Firestore) {
  return {
    async list(businessId: string, ownerUid: string, max = 50): Promise<Payment[]> {
      const snap = await getDocs(
        query(collection(db, 'payments'), where('businessId', '==', businessId), where('ownerUid', '==', ownerUid), orderBy('at', 'desc'), limit(max)),
      );
      return snap.docs.map((d) => paymentFrom(d.id, d.data()));
    },
  };
}

/** Ücretsiz kademede işletme sahibi hangi gönderinin görüneceğini seçer (Pro bitince gizlenenler). */
export function createPostVisibility(functions: Functions) {
  const call = httpsCallable<{ postId: string; visible: boolean }, { ok: boolean }>(functions, 'choosePostVisibility');
  return {
    async set(postId: string, visible: boolean): Promise<void> {
      await call({ postId, visible });
    },
  };
}
