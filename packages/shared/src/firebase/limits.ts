import { doc, getDoc, serverTimestamp, writeBatch, type Firestore, type WriteBatch } from 'firebase/firestore';

import {
  DEFAULT_LIMITS,
  isNewAccount,
  LimitReachedError,
  limitFor,
  nextUsage,
  normalizeLimits,
  USAGE_KINDS,
  usageId,
  type Limits,
  type UsageKind,
  type UsageSubject,
} from '../limits/limits';
import { addAudit, iso } from './grants';

const limitsRef = (db: Firestore) => doc(db, 'config', 'limits');

// Sayılar oturum başına bir kez okunur (kurallar her yazımda güncelini denetler).
let cached: { db: Firestore; limits: Promise<Limits> } | null = null;
function loadLimits(db: Firestore): Promise<Limits> {
  if (cached?.db !== db) {
    const limits = getDoc(limitsRef(db)).then(
      (s) => normalizeLimits(s.exists() ? s.data() : null),
      () => ({ ...DEFAULT_LIMITS }) as Limits,
    );
    cached = { db, limits };
  }
  return cached.limits;
}

const created = new Map<string, Promise<string | undefined>>();
function accountCreatedAt(db: Firestore, uid: string): Promise<string | undefined> {
  if (!created.has(uid)) created.set(uid, getDoc(doc(db, 'users', uid)).then((s) => iso(s.get('createdAt')), () => undefined));
  return created.get(uid)!;
}

/**
 * İşi sayar: sayacı aynı toplu yazıma ekler. Sınır dolduysa yazmadan `LimitReachedError` atar (kurallar da reddeder).
 * `uid`: işi yapan kişi (yeni hesap sınırı için).
 */
export async function countUsage(db: Firestore, batch: WriteBatch, subject: UsageSubject, kind: UsageKind, uid: string): Promise<void> {
  const ref = doc(db, 'usage', usageId(subject, kind));
  const [snap, limits, createdAt] = await Promise.all([getDoc(ref), loadLimits(db), subject.type === 'u' ? accountCreatedAt(db, uid) : undefined]);
  const old = snap.exists() ? { windowStart: iso(snap.get('windowStart')) ?? new Date(0).toISOString(), count: (snap.get('count') as number) ?? 0 } : null;
  const limit = limitFor(kind, subject, limits, isNewAccount(createdAt, new Date()));
  const next = nextUsage(old, kind, limit, new Date());
  if (!next.allowed) throw new LimitReachedError(kind, next.resetAt);
  batch.set(
    ref,
    next.reset
      ? { type: subject.type, sid: subject.id, kind, windowStart: serverTimestamp(), count: 1 }
      : { type: subject.type, sid: subject.id, kind, windowStart: snap.get('windowStart'), count: next.count },
  );
}

/** Hesap silinirken kişinin günlük sınır sayaçları. */
export async function deleteUsageOf(db: Firestore, uid: string): Promise<void> {
  const batch = writeBatch(db);
  USAGE_KINDS.forEach((kind) => batch.delete(doc(db, 'usage', usageId({ type: 'u', id: uid }, kind))));
  await batch.commit();
}

/** Panel (admin): sınır sayıları. Her değişiklik işlem kaydına yazılır. */
export function createLimitsAdmin(db: Firestore) {
  return {
    async get(): Promise<Limits> {
      const snap = await getDoc(limitsRef(db));
      return normalizeLimits(snap.exists() ? snap.data() : null);
    },
    async save(actorUid: string, limits: Limits): Promise<Limits> {
      const clean = normalizeLimits(limits);
      const batch = writeBatch(db);
      batch.set(limitsRef(db), { ...clean, updatedBy: actorUid, updatedAt: serverTimestamp() });
      addAudit(db, batch, { actorUid, module: 'moderasyon', action: 'duzenle', targetId: 'limits', summary: 'Günlük sınırlar güncellendi' });
      await batch.commit();
      cached = null;
      return clean;
    },
  };
}
