import { collection, getDocs, limit, orderBy, query, where, type Firestore } from 'firebase/firestore';
import { httpsCallable, type Functions } from 'firebase/functions';

import type { SuspendRequest, Suspension } from '../posts/suspension';
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
  };
}
