import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { validSuspendRequest } from '@cityjoy/shared';

/**
 * Hesap askıya alma (Eren, 12 Kasım 2026). Yalnızca admin. Giriş kapatılır ve açık oturumlar düşürülür (Auth),
 * profil "askıya alınmış" işaretlenir, kayıt suspensions/{uid}'e ve işlem kaydına yazılır. Admin askıya alınamaz,
 * kişi kendini askıya alamaz. Auth işlemleri testte sahte olsun diye dışarıdan verilir.
 */
export interface AccountSwitch {
  disable(uid: string): Promise<void>;
  enable(uid: string): Promise<void>;
}

export class SuspensionError extends Error {
  constructor(public readonly code: 'yetki' | 'gecersiz' | 'admin' | 'yok') {
    super(code);
  }
}

const isAdmin = async (db: Firestore, uid: string) => (await db.doc(`admins/${uid}`).get()).exists;

export async function handleSuspend(db: Firestore, accounts: AccountSwitch, actorUid: string, data: unknown, now: Date): Promise<void> {
  if (!(await isAdmin(db, actorUid))) throw new SuspensionError('yetki');
  if (!validSuspendRequest(data)) throw new SuspensionError('gecersiz');
  const { uid, reason, days, note } = data;
  if (uid === actorUid || (await isAdmin(db, uid))) throw new SuspensionError('admin');
  const profile = await db.doc(`publicProfiles/${uid}`).get();
  const user = await db.doc(`users/${uid}`).get();
  if (!profile.exists && !user.exists) throw new SuspensionError('yok');

  await accounts.disable(uid);
  const at = Timestamp.fromDate(now);
  const until = days ? Timestamp.fromMillis(now.getTime() + days * 86_400_000) : null;
  const displayName = (profile.get('displayName') as string | undefined) ?? '';
  const batch = db.batch();
  batch.set(db.doc(`suspensions/${uid}`), {
    uid, displayName, reason, note: note?.trim() ?? '', active: true, until, at, by: actorUid,
  });
  if (profile.exists) batch.update(profile.ref, { suspended: true });
  batch.set(db.collection('auditLog').doc(), {
    actorUid, module: 'moderasyon', action: 'duzenle', targetId: uid, at,
    summary: `Hesap askıya alındı (${displayName || uid}; ${reason}; ${days ? `${days} gün` : 'süresiz'})`,
  });
  await batch.commit();
  await markPosts(db, uid, true);
}

/** Kişinin kendi adına paylaştığı gönderileri akışlardan gizler ya da geri açar (işletme adına olanlar işletmenindir). */
async function markPosts(db: Firestore, uid: string, suspended: boolean): Promise<void> {
  const snap = await db.collection('posts').where('authorUid', '==', uid).get();
  const docs = snap.docs.filter((d) => !d.get('business'));
  for (let i = 0; i < docs.length; i += 400) {
    const b = db.batch();
    for (const d of docs.slice(i, i + 400)) b.update(d.ref, { authorSuspended: suspended ? true : FieldValue.delete() });
    await b.commit();
  }
}

/** Askıyı kaldırır. actorUid "sure" ise süresi dolduğu için sunucu kaldırıyordur (yetki denetimi yok). */
export async function handleLift(db: Firestore, accounts: AccountSwitch, actorUid: string | 'sure', uid: unknown, now: Date): Promise<void> {
  if (actorUid !== 'sure' && !(await isAdmin(db, actorUid))) throw new SuspensionError('yetki');
  if (typeof uid !== 'string' || !uid) throw new SuspensionError('gecersiz');
  const ref = db.doc(`suspensions/${uid}`);
  const s = await ref.get();
  if (!s.exists || s.get('active') !== true) throw new SuspensionError('yok');

  await accounts.enable(uid);
  const at = Timestamp.fromDate(now);
  const batch = db.batch();
  // until silinir ki süre sorgusu kaldırılan askıyı yeniden bulmasın.
  batch.update(ref, { active: false, until: null, liftedAt: at, liftedBy: actorUid });
  const profile = db.doc(`publicProfiles/${uid}`);
  if ((await profile.get()).exists) batch.update(profile, { suspended: FieldValue.delete() });
  batch.set(db.collection('auditLog').doc(), {
    actorUid: actorUid === 'sure' ? 'sistem' : actorUid, module: 'moderasyon', action: 'duzenle', targetId: uid, at,
    summary: actorUid === 'sure' ? `Hesabın askı süresi doldu, açıldı (${s.get('displayName') || uid})` : `Hesabın askısı kaldırıldı (${s.get('displayName') || uid})`,
  });
  await batch.commit();
  await markPosts(db, uid, false);
}

/** Günlük: süresi dolan askıları kaldırır. Döner: kaç hesap açıldı. */
export async function liftExpiredSuspensions(db: Firestore, accounts: AccountSwitch, now: Date): Promise<number> {
  const snap = await db.collection('suspensions').where('until', '<=', Timestamp.fromDate(now)).limit(200).get();
  let n = 0;
  for (const d of snap.docs) {
    if (d.get('active') !== true) continue;
    await handleLift(db, accounts, 'sure', d.id, now);
    n++;
  }
  return n;
}
