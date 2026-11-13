import { Timestamp, type DocumentData, type Firestore } from 'firebase-admin/firestore';
import {
  BROADCAST_DAILY_LIMIT,
  BROADCAST_LIMITS,
  CITYJOY_PUBLISHER,
  broadcastNeedsApproval,
  reachShown,
  regionShapeOk,
  regionWithin,
  translations,
  validateBroadcast,
  type AnnouncementRegion,
  type BroadcastAuthor,
  type BroadcastInput,
  type RegionScope,
} from '@cityjoy/shared';

import { notifyUsers, type NotifyDeps } from './push';

/**
 * Bölgeye toplu bildirim (PROJE.md 7). Panel yazmaz; her şeyi bu işlevler yapar: yetki (kurum görevi, kişi yetkisi
 * ya da admin; hedef bölge hesabın bölgesinde), günlük sınır, ulaşılacak kişi sayısı (kişiler gösterilmez), il geneli
 * ise admin onayı, gönderim ve işlem kaydı. Kayıt broadcasts/{id}.
 */
export class BroadcastError extends Error {
  constructor(public readonly code: 'yetki' | 'gecersiz' | 'sinir' | 'yok') {
    super(code);
  }
}

/** Çağıranın kimliği (giriş belgesinden). */
export interface Actor {
  uid: string;
  email?: string;
  emailVerified?: boolean;
}

interface Account {
  author: BroadcastAuthor;
  sourceName: string;
  isAdmin: boolean;
}

const isAdmin = async (db: Firestore, uid: string) => (await db.doc(`admins/${uid}`).get()).exists;
const millis = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : typeof v === 'string' ? new Date(v).getTime() : null);
const notExpired = (v: unknown, now: Date) => v == null || (millis(v) ?? 0) > now.getTime();
const push = translations.tr.notifications.push;

/** Hesap bu kişinin mi, Bildirimler'de "Bildirim gönder" görevi var mı, bölge hesabın bölgesinde mi? */
async function accountFor(db: Firestore, actor: Actor, publisherKey: string, region: AnnouncementRegion, now: Date): Promise<Account> {
  if (publisherKey === CITYJOY_PUBLISHER) {
    if (!(await isAdmin(db, actor.uid))) throw new BroadcastError('yetki');
    return { author: { type: 'cityjoy' }, sourceName: push.cityjoy, isAdmin: true };
  }
  if (!actor.email || !actor.emailVerified) throw new BroadcastError('yetki');
  const email = actor.email.toLowerCase();
  const admin = await isAdmin(db, actor.uid);
  const grant = await db.doc(`grants/${email}__${publisherKey}`).get();
  if (grant.exists) {
    const g = grant.data()!;
    const role = g.role as string;
    const ok =
      !g.orgId &&
      (role === 'muhtar' || role === 'il-yoneticisi') &&
      g.revokedAt == null &&
      notExpired(g.expiresAt, now) &&
      ((g.modules?.bildirimler as string[] | undefined) ?? []).includes('bildirim-gonder') &&
      regionWithin(region, g.scope as RegionScope);
    if (!ok) throw new BroadcastError('yetki');
    return { author: { type: 'kisi', role: role as 'muhtar' | 'il-yoneticisi', grantKey: publisherKey }, sourceName: role === 'muhtar' ? push.muhtar : push.cityjoy, isAdmin: admin };
  }
  const [org, member] = await Promise.all([db.doc(`organizations/${publisherKey}`).get(), db.doc(`orgMembers/${publisherKey}__${email}`).get()]);
  const o = org.data();
  const m = member.data();
  const ok =
    !!o &&
    !!m &&
    o.status === 'aktif' &&
    notExpired(o.contractEndsAt, now) &&
    m.removedAt == null &&
    notExpired(m.expiresAt, now) &&
    ((o.modules as string[] | undefined) ?? []).includes('bildirimler') &&
    ((m.assignments?.bildirimler as string[] | undefined) ?? []).includes('bildirim-gonder') &&
    regionWithin(region, o.scope as RegionScope);
  if (!ok) throw new BroadcastError('yetki');
  return { author: { type: 'kurum', orgId: publisherKey, name: String(o!.name) }, sourceName: String(o!.name), isAdmin: admin };
}

/** Yalnızca bilinen alanlar (fazla alan kayda girmesin). */
const cleanRegion = (r: Partial<AnnouncementRegion> = {}): AnnouncementRegion => ({
  provinceCode: String(r.provinceCode ?? ''),
  ...(r.districtId ? { districtId: String(r.districtId) } : {}),
  ...(r.districtId && r.neighbourhoodId ? { neighbourhoodId: String(r.neighbourhoodId) } : {}),
});

function cleanInput(data: unknown): BroadcastInput {
  const d = (data ?? {}) as Partial<BroadcastInput>;
  const region = cleanRegion(d.region);
  const input: BroadcastInput = {
    publisherKey: String(d.publisherKey ?? ''),
    kind: d.kind as BroadcastInput['kind'],
    title: typeof d.title === 'string' ? d.title.trim() : '',
    body: typeof d.body === 'string' ? d.body.trim() : '',
    region,
  };
  if (!input.publisherKey || validateBroadcast(input).length) throw new BroadcastError('gecersiz');
  return input;
}

/** Bölgede oturan kişilerin sayısı ya da kimlikleri (profildeki konuma göre; duyuru bildirimiyle aynı). */
function residentsQuery(db: Firestore, region: AnnouncementRegion) {
  let q = db.collection('users').where('location.provinceCode', '==', region.provinceCode);
  if (region.districtId) q = q.where('location.districtId', '==', region.districtId);
  if (region.neighbourhoodId) q = q.where('location.neighbourhoodId', '==', region.neighbourhoodId);
  return q;
}

/** Göndermeden önce: yaklaşık kaç kişiye ulaşır (küçük grupta sayı yerine null = "50'den az"). */
export async function handleBroadcastEstimate(db: Firestore, actor: Actor, data: unknown, now: Date): Promise<{ reach: number | null; needsApproval: boolean }> {
  const d = (data ?? {}) as { publisherKey?: unknown; region?: AnnouncementRegion };
  if (typeof d.publisherKey !== 'string' || !regionShapeOk(d.region)) throw new BroadcastError('gecersiz');
  const region = cleanRegion(d.region);
  const account = await accountFor(db, actor, d.publisherKey, region, now);
  const count = (await residentsQuery(db, region).count().get()).data().count;
  return { reach: reachShown(count), needsApproval: broadcastNeedsApproval(region, account.isAdmin) };
}

const turkeyDayStart = (now: Date) => {
  const local = new Date(now.getTime() + 3 * 3600_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - 3 * 3600_000);
};

/** Kaydı alıp bölgedekilere bildirimi gönderir; gönderilen kişi sayısını kayda yazar. Bir kayıt bir kez gönderilir. */
async function deliver(db: Firestore, id: string, b: DocumentData, deps: NotifyDeps): Promise<number> {
  try {
    await db.doc(`pushLog/toplu_${id}`).create({ at: deps.now });
  } catch {
    return 0;
  }
  const uids = (await residentsQuery(db, b.region).select().get()).docs.map((d) => d.id);
  const sent = await notifyUsers(
    db,
    uids,
    {
      kind: 'announcement',
      category: b.kind === 'acil' ? 'acil' : 'duyuru',
      title: String(b.sourceName),
      body: `${b.title}: ${b.body}`,
      href: { pathname: '/broadcast/[id]', params: { id } },
      source: b.author?.type === 'kurum' ? 'kurum' : 'kisi',
    },
    deps,
  );
  await db.doc(`broadcasts/${id}`).update({ sentCount: sent });
  return sent;
}

/**
 * Gönder: doğrudan gider ya da (il geneli, admin değil) onaya düşer. Günlük sınır hesap başına; admin'e sınır yok.
 * Dönen: kayıt kimliği ve durum.
 */
export async function handleBroadcastSend(db: Firestore, actor: Actor, data: unknown, deps: NotifyDeps): Promise<{ id: string; status: 'gonderildi' | 'onay-bekliyor' }> {
  const input = cleanInput(data);
  const account = await accountFor(db, actor, input.publisherKey, input.region, deps.now);
  if (!account.isAdmin) {
    const today = await db
      .collection('broadcasts')
      .where('publisherKey', '==', input.publisherKey)
      .where('createdAt', '>=', Timestamp.fromDate(turkeyDayStart(deps.now)))
      .count()
      .get();
    if (today.data().count >= BROADCAST_DAILY_LIMIT) throw new BroadcastError('sinir');
  }
  const pending = broadcastNeedsApproval(input.region, account.isAdmin);
  const at = Timestamp.fromDate(deps.now);
  const ref = db.collection('broadcasts').doc();
  const record = {
    publisherKey: input.publisherKey,
    author: account.author,
    sourceName: account.sourceName,
    kind: input.kind,
    title: input.title,
    body: input.body,
    region: input.region,
    status: pending ? 'onay-bekliyor' : 'gonderildi',
    preparedBy: actor.uid,
    createdAt: at,
    ...(pending ? {} : { sentAt: at }),
  };
  const batch = db.batch();
  batch.set(ref, record);
  batch.set(db.collection('auditLog').doc(), {
    actorUid: actor.uid,
    module: 'bildirimler',
    action: 'bildirim-gonder',
    targetId: ref.id,
    at,
    summary: `${pending ? 'Toplu bildirim onaya gönderildi' : 'Toplu bildirim gönderildi'} (${account.sourceName}; ${regionText(input.region)}): ${input.title}`,
  });
  await batch.commit();
  if (!pending) await deliver(db, ref.id, record, deps);
  return { id: ref.id, status: record.status as 'gonderildi' | 'onay-bekliyor' };
}

/** Admin: onaya düşen il geneli bildirimi onaylar (gönderilir) ya da gerekçeyle reddeder. */
export async function handleBroadcastReview(db: Firestore, actorUid: string, data: unknown, deps: NotifyDeps): Promise<void> {
  if (!(await isAdmin(db, actorUid))) throw new BroadcastError('yetki');
  const d = (data ?? {}) as { id?: unknown; approve?: unknown; note?: unknown };
  if (typeof d.id !== 'string' || !d.id || typeof d.approve !== 'boolean') throw new BroadcastError('gecersiz');
  const note = typeof d.note === 'string' ? d.note.trim() : '';
  if (!d.approve && (note.length < BROADCAST_LIMITS.reviewNote[0] || note.length > BROADCAST_LIMITS.reviewNote[1])) throw new BroadcastError('gecersiz');
  const ref = db.doc(`broadcasts/${d.id}`);
  const at = Timestamp.fromDate(deps.now);
  const record = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get('status') !== 'onay-bekliyor') throw new BroadcastError('yok');
    tx.update(ref, d.approve ? { status: 'gonderildi', sentAt: at, reviewedBy: actorUid } : { status: 'reddedildi', reviewNote: note, reviewedBy: actorUid });
    tx.set(db.collection('auditLog').doc(), {
      actorUid,
      module: 'bildirimler',
      action: 'onayla',
      targetId: d.id,
      at,
      summary: `Toplu bildirim ${d.approve ? 'onaylandı' : 'reddedildi'}: ${snap.get('title')}`,
    });
    return snap.data()!;
  });
  if (d.approve) await deliver(db, d.id, record, deps);
}

function regionText(r: AnnouncementRegion): string {
  return r.neighbourhoodId ?? r.districtId ?? `il ${r.provinceCode}`;
}

