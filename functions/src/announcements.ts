import { translations, type NotificationCategory } from '@cityjoy/shared';
import type { DocumentData, Firestore } from 'firebase-admin/firestore';

import { notifyUsers, type NotifyDeps } from './push';

const CATEGORY: Record<string, NotificationCategory> = { acil: 'acil', duyuru: 'duyuru', haber: 'haber' };

/** Bildirimde yayınlayanın adı: kurumun adı; muhtarda "Muhtarlık", il yöneticisinde "CityJoy" (Türkçe). */
function sourceName(author: DocumentData | undefined): string {
  if (author?.type === 'kurum' && typeof author.name === 'string') return author.name;
  const push = translations.tr.notifications.push;
  return author?.role === 'muhtar' ? push.muhtar : push.cityjoy;
}

/** Duyurunun bölgesinde (il > ilçe > mahalle) oturan kişiler, profillerindeki konuma göre. */
async function residents(db: Firestore, region: DocumentData): Promise<string[]> {
  let q = db.collection('users').where('location.provinceCode', '==', region.provinceCode);
  if (region.districtId) q = q.where('location.districtId', '==', region.districtId);
  if (region.neighbourhoodId) q = q.where('location.neighbourhoodId', '==', region.neighbourhoodId);
  return (await q.select().get()).docs.map((d) => d.id);
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
  try {
    await db.doc(`pushLog/duyuru_${id}`).create({ at: deps.now });
  } catch {
    return 0;
  }
  const uids = await residents(db, after.region);
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
