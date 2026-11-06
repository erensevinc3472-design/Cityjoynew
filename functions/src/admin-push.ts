import { adminPushHref, adminPushReaches, isEmptyTarget, PUSH_TARGET_MIN_GROUP, type AdminPush } from '@cityjoy/shared';
import { FieldValue, type DocumentData, type Firestore } from 'firebase-admin/firestore';

import { notifyUsers, type NotifyDeps } from './push';

/**
 * Admin bildirimini gönderir (PROJE.md 7; Karar Eren 5 Kasım 2026). Bölgedeki kişiler profillerindeki konuma göre
 * bulunur, hedef (yaş / cinsiyet / meslek) ve ticari iletide kampanya izni + 18 yaş süzülür. Hedefli gönderimde 50
 * kişiden küçük gruba gitmez. Bir bildirim bir kez gider (`pushLog/admin_{id}`); sonuç belgeye yazılır.
 */
export async function sendAdminPush(db: Firestore, id: string, d: DocumentData, deps: NotifyDeps): Promise<number> {
  if (d.status !== 'planli' || !d.sendAt || d.sendAt.toMillis() > deps.now.getTime() + 60000) return 0;
  try {
    await db.doc(`pushLog/admin_${id}`).create({ at: deps.now });
  } catch {
    return 0;
  }
  const push = { kind: d.kind, region: d.region ?? {}, target: d.target } as Pick<AdminPush, 'kind' | 'region' | 'target'>;
  let q: FirebaseFirestore.Query = db.collection('users');
  if (push.region.provinceCode) q = q.where('location.provinceCode', '==', push.region.provinceCode);
  if (push.region.districtId) q = q.where('location.districtId', '==', push.region.districtId);
  if (push.region.neighbourhoodId) q = q.where('location.neighbourhoodId', '==', push.region.neighbourhoodId);
  const docs = (await q.select('birthYear', 'gender', 'occupationId', 'location', 'consents.commercialMessages').get()).docs;
  const uids = docs.filter((u) => adminPushReaches(u.data() as Parameters<typeof adminPushReaches>[0], push, deps.now)).map((u) => u.id);
  const ref = db.doc(`adminPushes/${id}`);
  if (!isEmptyTarget(push.target) && uids.length < PUSH_TARGET_MIN_GROUP) {
    await ref.update({ status: 'gonderildi', sentAt: FieldValue.serverTimestamp(), recipients: 0, skipped: 'kucuk-grup' });
    return 0;
  }
  const commercial = d.kind === 'kampanya' || d.kind === 'reklam';
  const sent = await notifyUsers(
    db,
    uids,
    {
      kind: 'adminPush',
      category: commercial ? 'kampanya' : d.kind === 'etkinlik' ? 'etkinlik' : 'duyuru',
      title: d.kind === 'reklam' && d.business?.name ? `${d.business.name}: ${d.title}` : String(d.title),
      body: String(d.body),
      href: adminPushHref(d.link ?? { type: 'yok' }),
      source: 'kurum',
      ...(commercial ? { tag: d.kind as 'reklam' | 'kampanya' } : {}),
      adminPushId: id,
    },
    deps,
  );
  await ref.update({ status: 'gonderildi', sentAt: FieldValue.serverTimestamp(), recipients: uids.length });
  return sent;
}

/** Zamanı gelen planlı admin bildirimleri (10 dakikada bir). */
export async function sendDueAdminPushes(db: Firestore, deps: NotifyDeps): Promise<number> {
  const snap = await db.collection('adminPushes').where('status', '==', 'planli').where('sendAt', '<=', deps.now).limit(20).get();
  let n = 0;
  for (const d of snap.docs) n += await sendAdminPush(db, d.id, d.data(), deps);
  return n;
}
