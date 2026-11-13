/**
 * Ölçümlü Firestore (Panel > Harcama > Özelliklere göre; billing/cost.ts). Bu klasördeki depolar 'firebase/firestore'
 * yerine buradan alır: her şey aynıdır, yalnızca okuma ve yazmalar koleksiyon adına göre bellekte sayılır. Sayaç
 * yalnızca bellekte tutulur, kendisi veritabanına dokunmaz; örneklemdeki kullanıcının uygulaması günde birkaç kez
 * toplu gönderir (apps/mobile/src/lib/usage-meter.ts). Sayım yaklaşıktır (Google'ın faturasına göre: sorgu en az bir
 * okuma, canlı dinlemede değişen her belge bir okuma).
 */
import * as fs from 'firebase/firestore';
import type { DocumentData, DocumentReference, Query, QuerySnapshot } from 'firebase/firestore';

export * from 'firebase/firestore';

const reads = new Map<string, number>();
const writes = new Map<string, number>();

const add = (m: Map<string, number>, key: string, n: number) => {
  if (n > 0) m.set(key, (m.get(key) ?? 0) + n);
};

/** Yolun ilk parçası (koleksiyon adı). */
const rootOf = (path: string | undefined) => (path ? path.split('/')[0] || 'diger' : 'diger');

/** Sorgunun koleksiyonu (sonuç boşsa da): genel alanlar yoksa iç yapıdan, o da yoksa "diger". */
function rootOfQuery(q: Query<DocumentData> | DocumentReference<DocumentData>): string {
  const anyQ = q as unknown as { path?: string; _query?: { path?: { segments?: string[] }; collectionGroup?: string | null } };
  if (typeof anyQ.path === 'string') return rootOf(anyQ.path);
  return anyQ._query?.collectionGroup || anyQ._query?.path?.segments?.[0] || 'diger';
}

/** Şimdiye kadarki sayımı verir ve sıfırlar. */
export function takeFirestoreUsage(): { reads: Record<string, number>; writes: Record<string, number> } {
  const out = { reads: Object.fromEntries(reads), writes: Object.fromEntries(writes) };
  reads.clear();
  writes.clear();
  return out;
}

export const getDoc: typeof fs.getDoc = (async (ref: DocumentReference) => {
  const snap = await fs.getDoc(ref);
  add(reads, rootOf(ref.path), 1);
  return snap;
}) as typeof fs.getDoc;

export const getDocFromServer: typeof fs.getDocFromServer = (async (ref: DocumentReference) => {
  const snap = await fs.getDocFromServer(ref);
  add(reads, rootOf(ref.path), 1);
  return snap;
}) as typeof fs.getDocFromServer;

const countQuery = (q: Query<DocumentData>, snap: QuerySnapshot<DocumentData>) => {
  if (snap.metadata.fromCache) return;
  add(reads, snap.docs[0] ? rootOf(snap.docs[0].ref.path) : rootOfQuery(q), Math.max(1, snap.size));
};

export const getDocs: typeof fs.getDocs = (async (q: Query<DocumentData>) => {
  const snap = await fs.getDocs(q);
  countQuery(q, snap);
  return snap;
}) as typeof fs.getDocs;

export const getDocsFromServer: typeof fs.getDocsFromServer = (async (q: Query<DocumentData>) => {
  const snap = await fs.getDocsFromServer(q);
  countQuery(q, snap);
  return snap;
}) as typeof fs.getDocsFromServer;

export const getCountFromServer: typeof fs.getCountFromServer = (async (q: Query<DocumentData>) => {
  const r = await fs.getCountFromServer(q);
  add(reads, rootOfQuery(q), 1);
  return r;
}) as typeof fs.getCountFromServer;

/** Canlı dinleme: ilk sonuçtaki her belge, sonra değişen her belge bir okuma. */
export const onSnapshot: typeof fs.onSnapshot = ((ref: Query<DocumentData> | DocumentReference<DocumentData>, ...rest: unknown[]) => {
  const key = rootOfQuery(ref);
  const tally = (snap: unknown) => {
    const s = snap as { metadata?: { fromCache?: boolean }; docChanges?: () => unknown[] };
    if (s.metadata?.fromCache) return;
    add(reads, key, typeof s.docChanges === 'function' ? Math.max(1, s.docChanges().length) : 1);
  };
  const i = rest.findIndex((a) => typeof a === 'function' || (!!a && typeof a === 'object' && typeof (a as { next?: unknown }).next === 'function'));
  if (i >= 0) {
    const a = rest[i];
    if (typeof a === 'function') rest[i] = (snap: unknown) => (tally(snap), (a as (s: unknown) => void)(snap));
    else {
      const o = a as { next: (s: unknown) => void };
      rest[i] = { ...o, next: (snap: unknown) => (tally(snap), o.next(snap)) };
    }
  }
  return (fs.onSnapshot as (...a: unknown[]) => fs.Unsubscribe)(ref, ...rest);
}) as typeof fs.onSnapshot;

export const setDoc: typeof fs.setDoc = ((ref: DocumentReference, ...rest: unknown[]) => {
  add(writes, rootOf(ref.path), 1);
  return (fs.setDoc as (...a: unknown[]) => Promise<void>)(ref, ...rest);
}) as typeof fs.setDoc;

export const updateDoc: typeof fs.updateDoc = ((ref: DocumentReference, ...rest: unknown[]) => {
  add(writes, rootOf(ref.path), 1);
  return (fs.updateDoc as (...a: unknown[]) => Promise<void>)(ref, ...rest);
}) as typeof fs.updateDoc;

export const deleteDoc: typeof fs.deleteDoc = ((ref: DocumentReference) => {
  add(writes, rootOf(ref.path), 1);
  return fs.deleteDoc(ref);
}) as typeof fs.deleteDoc;

export const addDoc: typeof fs.addDoc = ((ref: fs.CollectionReference, data: unknown) => {
  add(writes, rootOf(ref.path), 1);
  return (fs.addDoc as (...a: unknown[]) => Promise<DocumentReference>)(ref, data);
}) as typeof fs.addDoc;

/** Toplu yazım: her set/update/delete bir yazma (gönderilince sayılır). */
export const writeBatch: typeof fs.writeBatch = ((db: fs.Firestore) => {
  const batch = fs.writeBatch(db);
  const pending: string[] = [];
  const wrap = <K extends 'set' | 'update' | 'delete'>(k: K) => {
    const orig = (batch[k] as (...a: unknown[]) => fs.WriteBatch).bind(batch);
    (batch as unknown as Record<string, unknown>)[k] = (ref: DocumentReference, ...rest: unknown[]) => {
      pending.push(rootOf(ref.path));
      orig(ref, ...rest);
      return batch;
    };
  };
  wrap('set');
  wrap('update');
  wrap('delete');
  const commit = batch.commit.bind(batch);
  batch.commit = async () => {
    await commit();
    pending.forEach((k) => add(writes, k, 1));
  };
  return batch;
}) as typeof fs.writeBatch;
