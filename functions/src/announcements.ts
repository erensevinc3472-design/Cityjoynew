import { adminPushReaches, isEmptyTarget, matchesPushTarget, PUSH_TARGET_MIN_GROUP, regionWithin, roundAudience, type AudienceFilter, type AnnouncementRegion, type NotificationCategory, type RegionScope, translations } from '@cityjoy/shared';
import type { DocumentData, Firestore } from 'firebase-admin/firestore';

import { notifyUsers, type NotifyDeps } from './push';

const CATEGORY: Record<string, NotificationCategory> = { acil: 'acil', duyuru: 'duyuru', haber: 'haber' };

/** Bildirimde yayınlayanın adı: kurumun adı; muhtarda "Muhtarlık", il yöneticisinde "CityJoy" (Türkçe). */
function sourceName(author: DocumentData | undefined): string {
  if (author?.type === 'kurum' && typeof author.name === 'string') return author.name;
  const push = translations.tr.notifications.push;
  return author?.role === 'muhtar' ? push.muhtar : push.cityjoy;
}

/**
 * Duyurunun bölgesinde (il > ilçe > mahalle) oturan kişiler, profillerindeki konuma göre. Hedef verilirse (yaş, cinsiyet,
 * meslek) yalnızca hedefe uyanlar (PROJE.md 7; ayrı izin aranmaz, Karar Eren 5 Kasım 2026).
 */
export async function residents(db: Firestore, region: DocumentData, target?: AudienceFilter | null, now = new Date()): Promise<string[]> {
  let q = db.collection('users').where('location.provinceCode', '==', region.provinceCode);
  if (region.districtId) q = q.where('location.districtId', '==', region.districtId);
  if (region.neighbourhoodId) q = q.where('location.neighbourhoodId', '==', region.neighbourhoodId);
  if (isEmptyTarget(target)) return (await q.select().get()).docs.map((d) => d.id);
  const docs = (await q.select('birthYear', 'gender', 'occupationId').get()).docs;
  return docs.filter((d) => matchesPushTarget(d.data() as Parameters<typeof matchesPushTarget>[0], target, now)).map((d) => d.id);
}

/**
 * Duyuru, acil duyuru ya da kurum haberi yayına girince bölgedekilere telefon bildirimi (PROJE.md 5.12, 7). Süresi
 * geçmişse gönderilmez. Tetikleyici birden çok kez çalışsa da bir duyuru için bir kez gönderilir (`pushLog`).
 */
export async function handleAnnouncementWrite(
  db: Firestore,
  id: string,
  before: DocumentData | undefined,
  after: DocumentData | undefined,
  deps: NotifyDeps,
): Promise<number> {
  if (after?.status !== 'yayinda' || before?.status === 'yayinda') return 0;
  const category = CATEGORY[after.kind];
  if (!category || !after.region?.provinceCode) return 0;
  if (after.endsAt && after.endsAt.toMillis() < deps.now.getTime()) return 0;
  // Planlı yayın: zamanı gelmeden bildirim gitmez; zamanı gelince sendScheduledAnnouncements gönderir.
  if (after.publishedAt?.toMillis && after.publishedAt.toMillis() > deps.now.getTime() + 60000) return 0;
  try {
    await db.doc(`pushLog/duyuru_${id}`).create({ at: deps.now });
  } catch {
    return 0;
  }
  const target = after.kind === 'acil' ? null : (after.pushTarget as AudienceFilter | undefined);
  const uids = await residents(db, after.region, target, deps.now);
  // Hedefli bildirimde 50 kişiden küçük gruba gönderilmez (bir kişi tanınmasın); kayda düşülür.
  if (!isEmptyTarget(target) && uids.length < PUSH_TARGET_MIN_GROUP) {
    await db.doc(`pushLog/duyuru_${id}`).set({ skipped: 'kucuk-grup' }, { merge: true });
    return 0;
  }
  return notifyUsers(
    db,
    uids,
    {
      kind: 'announcement',
      category,
      title: sourceName(after.author),
      body: String(after.title ?? ''),
      href: { pathname: '/announcements/[id]', params: { id } },
      source: after.author?.type === 'kurum' ? 'kurum' : 'kisi',
      ringAlways: after.ringAlways === true,
    },
    deps,
  );
}

/**
 * Planlı duyurular (PROJE.md 6.2 madde 4): yayın anı son 30 dakikada gelmiş olanların bildirimini gönderir (10 dakikada
 * bir çalışır; bir duyuru için bir kez, `pushLog`). Belgeyi değiştirmez: uygulama zamanı gelince kendiliğinden gösterir.
 */
export async function sendScheduledAnnouncements(db: Firestore, deps: NotifyDeps): Promise<number> {
  const from = new Date(deps.now.getTime() - 30 * 60000);
  const snap = await db.collection('announcements').where('status', '==', 'yayinda')
    .where('publishedAt', '>', from).where('publishedAt', '<=', deps.now).limit(200).get();
  let sent = 0;
  for (const d of snap.docs) {
    if (!d.data().scheduledAt) continue;
    sent += await handleAnnouncementWrite(db, d.id, undefined, d.data(), deps);
  }
  return sent;
}

export interface AudienceRequest {
  /** Yayınlayan hesap: kurum kimliği ya da kişi yetkisinin anahtarı (il-.., mahalle-..); admin için önemsiz. */
  publisherKey: string;
  /** Admin ülke geneli için il boş olabilir. */
  region: Partial<AnnouncementRegion>;
  target: AudienceFilter | null;
  /** Kampanya / reklam (yalnızca admin): kampanya izni veren 18+ sayılır. */
  commercial?: boolean;
}

/**
 * Panel: hedefli bildirim kaç kişiye ulaşır (yaklaşık; 50'den azsa "az"). Kişi verisi panele gitmez. Soran kişi o hesapta
 * duyuru ekleyebilmeli ve bölge hesabın bölgesinin içinde olmalı; admin her yerde sorar.
 */
export async function estimateAudienceFor(
  db: Firestore,
  caller: { uid: string; email?: string; emailVerified?: boolean },
  req: AudienceRequest,
  now = new Date(),
): Promise<{ tooSmall: boolean; approx: number } | { denied: true }> {
  const region = req?.region ?? {};
  if (typeof req?.publisherKey !== 'string') return { denied: true };
  const admin = (await db.doc(`admins/${caller.uid}`).get()).exists;
  if (!admin && (!region.provinceCode || req.commercial)) return { denied: true };
  if (!admin) {
    if (!caller.email || caller.emailVerified !== true) return { denied: true };
    const alive = (d: DocumentData) => !d.removedAt && !d.revokedAt && (!d.expiresAt || d.expiresAt.toMillis() > now.getTime());
    let scope: RegionScope | null = null;
    if (/^(bld|krm)-/.test(req.publisherKey)) {
      const [org, member] = await Promise.all([
        db.doc(`organizations/${req.publisherKey}`).get(),
        db.doc(`orgMembers/${req.publisherKey}__${caller.email}`).get(),
      ]);
      const o = org.data();
      const m = member.data();
      if (o && m && o.status === 'aktif' && alive(m) && (o.modules ?? []).includes('gonderiler') && (m.assignments?.gonderiler ?? []).includes('ekle')) scope = o.scope;
    } else {
      const g = (await db.doc(`grants/${caller.email}__${req.publisherKey}`).get()).data();
      if (g && alive(g) && ['muhtar', 'il-yoneticisi'].includes(g.role) && (g.modules?.gonderiler ?? []).includes('ekle')) scope = g.scope;
    }
    if (!scope || !regionWithin(region as AnnouncementRegion, scope)) return { denied: true };
  }
  // Admin bildirimiyle aynı kural (bölge, hedef, ticari iletide izin + 18 yaş).
  let q: FirebaseFirestore.Query = db.collection('users');
  if (region.provinceCode) q = q.where('location.provinceCode', '==', region.provinceCode);
  if (region.districtId) q = q.where('location.districtId', '==', region.districtId);
  if (region.neighbourhoodId) q = q.where('location.neighbourhoodId', '==', region.neighbourhoodId);
  const docs = (await q.select('birthYear', 'gender', 'occupationId', 'location', 'consents.commercialMessages').get()).docs;
  const push = { kind: req.commercial ? 'kampanya' : 'duyuru', region, target: req.target ?? undefined } as const;
  return roundAudience(docs.filter((d) => adminPushReaches(d.data() as Parameters<typeof adminPushReaches>[0], push, now)).length);
}
