import { collection, doc, getDoc, getDocs, limit, orderBy, query, where, type Firestore } from 'firebase/firestore';
import { httpsCallable, type Functions } from 'firebase/functions';

import type { BusinessSuspendRequest, BusinessSuspension, SuspendRequest, Suspension } from '../posts/suspension';
import { iso } from './grants';

/**
 * Panel: hesap askıya alma (yalnızca admin). Yazma işini sunucu işlevi yapar (giriş kapatma Auth ister);
 * panel yalnızca etkin askıları listeler.
 */
export function createSuspensionAdmin(db: Firestore, functions: Functions) {
  return {
    async suspend(req: SuspendRequest): Promise<void> {
      await httpsCallable<SuspendRequest, { ok: boolean }>(functions, 'suspendAccount')(req);
    },
    async lift(uid: string): Promise<void> {
      await httpsCallable<{ uid: string }, { ok: boolean }>(functions, 'liftSuspension')({ uid });
    },
    async listActive(): Promise<Suspension[]> {
      const snap = await getDocs(query(collection(db, 'suspensions'), where('active', '==', true), orderBy('at', 'desc'), limit(200)));
      return snap.docs.map((d) => {
        const x = d.data();
        return {
          uid: d.id,
          displayName: x.displayName ?? '',
          reason: x.reason,
          note: x.note ?? '',
          active: true,
          ...(iso(x.until) ? { until: iso(x.until) } : {}),
          at: iso(x.at) ?? '',
          by: x.by ?? '',
        };
      });
    },
    async suspendBusiness(req: BusinessSuspendRequest): Promise<void> {
      await httpsCallable<BusinessSuspendRequest, { ok: boolean }>(functions, 'suspendBusiness')(req);
    },
    async liftBusiness(businessId: string): Promise<void> {
      await httpsCallable<{ businessId: string }, { ok: boolean }>(functions, 'liftBusinessSuspension')({ businessId });
    },
    /** Etkin işletme askıları, işletme kimliğine göre. */
    async listActiveBusinesses(): Promise<Map<string, BusinessSuspension>> {
      const snap = await getDocs(query(collection(db, 'businessSuspensions'), where('active', '==', true), limit(500)));
      return new Map(snap.docs.map((d) => [d.id, businessSuspensionFromDoc(d.id, d.data())]));
    },
  };
}

export function businessSuspensionFromDoc(id: string, x: Record<string, unknown>): BusinessSuspension {
  return {
    businessId: id,
    name: (x.name as string) ?? '',
    ownerUid: (x.ownerUid as string) ?? '',
    reason: x.reason as BusinessSuspension['reason'],
    note: (x.note as string) ?? '',
    banOwner: x.banOwner === true,
    active: x.active === true,
    ...(iso(x.until) ? { until: iso(x.until) } : {}),
    at: iso(x.at) ?? '',
    by: (x.by as string) ?? '',
  };
}

/** Uygulama: işletme sahibi kendi işletmesinin askı bilgisini ve kendine yeni işletme yasağı olup olmadığını okur. */
export function createOwnerSuspensionReader(db: Firestore) {
  return {
    async business(businessId: string): Promise<BusinessSuspension | null> {
      const s = await getDoc(doc(db, 'businessSuspensions', businessId));
      return s.exists() && s.get('active') === true ? businessSuspensionFromDoc(s.id, s.data()) : null;
    },
    async banned(uid: string): Promise<{ until?: string } | null> {
      const s = await getDoc(doc(db, 'businessBans', uid));
      if (!s.exists()) return null;
      const until = iso(s.get('until'));
      return until ? { until } : {};
    },
  };
}
