import type { DocumentData, Firestore, Timestamp } from 'firebase-admin/firestore';

import { notifyUsers, type NotifyDeps } from './push';

/** Katılanların kimlikleri (katılım belgesinin kimliği kişinin kimliğidir). */
async function attendeeIds(db: Firestore, path: string): Promise<string[]> {
  const snap = await db.collection(path).select().get();
  return snap.docs.map((d) => d.id);
}

const ended = (endsAt: Timestamp | undefined, now: Date) => !!endsAt && endsAt.toMillis() < now.getTime();

/**
 * Yayındaki etkinlik iptal edilince "Katılıyorum" diyenlere bildirim (PROJE.md 5.3). Bitmiş etkinlikte gönderilmez.
 * Yayındaki etkinliğin tarihi ve yeri değiştirilemediği için (kurallar) tek değişiklik iptaldir.
 */
export async function handleEventChange(
  db: Firestore,
  id: string,
  before: DocumentData | undefined,
  after: DocumentData | undefined,
  deps: NotifyDeps,
): Promise<number> {
  if (before?.status !== 'yayinda' || after?.status !== 'iptal' || ended(after.endsAt, deps.now)) return 0;
  const uids = await attendeeIds(db, `events/${id}/attendees`);
  return notifyUsers(
    db,
    uids,
    { kind: 'eventCancelled', category: 'etkinlik', title: String(after.title ?? ''), href: { pathname: '/events/[id]', params: { id } } },
    deps,
  );
}

/** Kullanıcı aktivitesi iptal edilince katılanlara bildirim (düzenleyen hariç). */
export async function handleActivityChange(
  db: Firestore,
  id: string,
  before: DocumentData | undefined,
  after: DocumentData | undefined,
  deps: NotifyDeps,
): Promise<number> {
  if (before?.status !== 'aktif' || after?.status !== 'iptal' || ended(after.endsAt, deps.now)) return 0;
  const uids = (await attendeeIds(db, `activities/${id}/attendees`)).filter((uid) => uid !== after.organizerUid);
  return notifyUsers(
    db,
    uids,
    { kind: 'activityCancelled', category: 'etkinlik', title: String(after.title ?? ''), href: { pathname: '/activities/[id]', params: { id } } },
    deps,
  );
}
