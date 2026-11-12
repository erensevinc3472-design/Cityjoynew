import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { validBusinessSuspendRequest } from '@cityjoy/shared';

import { SuspensionError } from './suspensions';

/**
 * İşletme askıya alma (Eren, 12 Kasım 2026). Yalnızca admin. İşletme "kaldirildi" durumuna geçer (herkesten gizli;
 * sahibi ve yetkilileri açamaz, düzenleyemez, işletme adına paylaşamaz; bunları kurallar zaten engeller). Kayıt
 * businessSuspensions/{id}'e, istenirse sahibine yeni işletme yasağı businessBans/{ownerUid}'e yazılır. Askı
 * kalkınca işletme eski durumuna (yayında ya da sahibinin gizlediği) döner, yasak da kalkar.
 */
const isAdmin = async (db: Firestore, uid: string) => (await db.doc(`admins/${uid}`).get()).exists;

export async function handleBusinessSuspend(db: Firestore, actorUid: string, data: unknown, now: Date): Promise<void> {
  if (!(await isAdmin(db, actorUid))) throw new SuspensionError('yetki');
  if (!validBusinessSuspendRequest(data)) throw new SuspensionError('gecersiz');
  const { businessId, reason, days, note, banOwner } = data;
  const biz = await db.doc(`businesses/${businessId}`).get();
  if (!biz.exists) throw new SuspensionError('yok');
  const ownerUid = biz.get('ownerUid') as string;
  const name = (biz.get('name') as string | undefined) ?? '';
  const prev = await db.doc(`businessSuspensions/${businessId}`).get();
  // Zaten askıdaysa önceki durum korunur (yeniden askıya almak yalnızca sebebi/süreyi günceller).
  const prevStatus = prev.get('active') === true ? prev.get('prevStatus') : biz.get('status') === 'gizli' ? 'gizli' : 'yayinda';

  const at = Timestamp.fromDate(now);
  const until = days ? Timestamp.fromMillis(now.getTime() + days * 86_400_000) : null;
  const batch = db.batch();
  batch.update(biz.ref, { status: 'kaldirildi', updatedAt: at });
  batch.set(prev.ref, { businessId, name, ownerUid, reason, note: note?.trim() ?? '', banOwner, prevStatus, active: true, until, at, by: actorUid });
  const ban = db.doc(`businessBans/${ownerUid}`);
  if (banOwner) batch.set(ban, { uid: ownerUid, businessId, until, at, by: actorUid });
  else if ((await ban.get()).get('businessId') === businessId) batch.delete(ban);
  batch.set(db.collection('auditLog').doc(), {
    actorUid, module: 'isletme-dogrulama', action: 'sil', targetId: businessId, at,
    region: { provinceCode: biz.get('location.provinceCode') ?? '', districtId: biz.get('location.districtId') ?? '' },
    summary: `İşletme askıya alındı (${name}; ${reason}; ${days ? `${days} gün` : 'süresiz'}${banOwner ? '; sahibi yeni işletme açamaz' : ''})`,
  });
  await batch.commit();
}

/** Askıyı kaldırır; actorUid "sure" ise süresi dolduğu için sunucu kaldırıyordur. */
export async function handleBusinessLift(db: Firestore, actorUid: string | 'sure', businessId: unknown, now: Date): Promise<void> {
  if (actorUid !== 'sure' && !(await isAdmin(db, actorUid))) throw new SuspensionError('yetki');
  if (typeof businessId !== 'string' || !businessId) throw new SuspensionError('gecersiz');
  const biz = await db.doc(`businesses/${businessId}`).get();
  const ref = db.doc(`businessSuspensions/${businessId}`);
  const s = await ref.get();
  const active = s.get('active') === true;
  // Eski "Yayından kaldır" ile kaldırılmış (askı kaydı olmayan) işletme de buradan açılır.
  if (!biz.exists || (!active && biz.get('status') !== 'kaldirildi')) throw new SuspensionError('yok');

  const at = Timestamp.fromDate(now);
  const batch = db.batch();
  batch.update(biz.ref, { status: active ? (s.get('prevStatus') ?? 'yayinda') : 'yayinda', updatedAt: at });
  if (active) batch.update(ref, { active: false, until: null, liftedAt: at, liftedBy: actorUid });
  const ban = db.doc(`businessBans/${biz.get('ownerUid')}`);
  if ((await ban.get()).get('businessId') === businessId) batch.delete(ban);
  const name = biz.get('name') ?? businessId;
  batch.set(db.collection('auditLog').doc(), {
    actorUid: actorUid === 'sure' ? 'sistem' : actorUid, module: 'isletme-dogrulama', action: 'duzenle', targetId: businessId, at,
    region: { provinceCode: biz.get('location.provinceCode') ?? '', districtId: biz.get('location.districtId') ?? '' },
    summary: actorUid === 'sure' ? `İşletmenin askı süresi doldu, açıldı (${name})` : `İşletmenin askısı kaldırıldı (${name})`,
  });
  await batch.commit();
}

/** Saatlik: süresi dolan işletme askılarını kaldırır. Döner: kaç işletme açıldı. */
export async function liftExpiredBusinessSuspensions(db: Firestore, now: Date): Promise<number> {
  const snap = await db.collection('businessSuspensions').where('until', '<=', Timestamp.fromDate(now)).limit(200).get();
  let n = 0;
  for (const d of snap.docs) {
    if (d.get('active') !== true) continue;
    await handleBusinessLift(db, 'sure', d.id, now);
    n++;
  }
  return n;
}
