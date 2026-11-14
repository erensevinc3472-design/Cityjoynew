/**
 * Pro bitince fazla gönderiler (Karar Eren, 12 Kasım 2026): hiçbir şey silinmez. Ücretsiz sınırdan (Panel > Sınırlar,
 * `isletmeGonderiToplam`, varsayılan 9) fazlası gizlenir (`tierHidden`; yalnızca sunucu yazar), en yeniler görünür kalır.
 * Pro yeniden açılınca hepsi geri gelir. Sahibi gizlenen bir gönderiyi "Göster" derse en eski görünen onunla yer değiştirir.
 * Bitişten 3 gün önce (yenileme kapalıysa) sahibine bildirim gider.
 */
import { FieldValue, Timestamp, type DocumentData, type Firestore } from 'firebase-admin/firestore';
import { DEFAULT_LIMITS } from '@cityjoy/shared';

import { notifyUsers, type NotifyDeps } from './push';

export class TierVisibilityError extends Error {
  constructor(public code: 'gecersiz' | 'yok' | 'yetki' | 'pro') {
    super(code);
  }
}

/** Pro yalnızca doğrulanmış işletmede geçerli (shared isProBusiness ile aynı). */
const isPro = (d: DocumentData | undefined) => d?.verification?.status === 'dogrulandi' && (d?.membership?.tier === 'pro' || d?.membership?.tier === 'premium');

async function freePostLimit(db: Firestore): Promise<number> {
  const v = (await db.doc('config/limits').get()).get('isletmeGonderiToplam');
  return typeof v === 'number' && v >= 0 ? v : DEFAULT_LIMITS.isletmeGonderiToplam;
}

const millis = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : 0);

/** İşletmenin yayındaki gönderileri, yeniden eskiye. */
async function activePosts(db: Firestore, businessId: string) {
  const snap = await db.collection('posts').where('business.id', '==', businessId).where('status', '==', 'aktif').get();
  return snap.docs.sort((a, b) => millis(b.get('createdAt')) - millis(a.get('createdAt')));
}

async function commitUpdates(db: Firestore, updates: { ref: FirebaseFirestore.DocumentReference; data: DocumentData }[]) {
  for (let i = 0; i < updates.length; i += 400) {
    const batch = db.batch();
    updates.slice(i, i + 400).forEach((u) => batch.update(u.ref, u.data));
    await batch.commit();
  }
}

/** Pro'ya göre gönderileri gizler ya da açar. Değişen gönderi sayısını döndürür. */
export async function applyTierVisibility(db: Firestore, businessId: string, pro: boolean): Promise<number> {
  const posts = await activePosts(db, businessId);
  const limit = pro ? Infinity : await freePostLimit(db);
  const updates = posts.flatMap((p, i) => {
    const hide = i >= limit;
    const hidden = p.get('tierHidden') === true;
    if (hide === hidden) return [];
    return [{ ref: p.ref, data: { tierHidden: hide ? true : FieldValue.delete() } }];
  });
  await commitUpdates(db, updates);
  return updates.length;
}

/** İşletme kaydı değişince: Pro açıldı ya da kapandıysa (kademe ya da doğrulama) gönderileri ayarlar. */
export async function handleBusinessTierChange(db: Firestore, businessId: string, before: DocumentData | undefined, after: DocumentData | undefined): Promise<number> {
  if (!after) return 0;
  const was = isPro(before);
  const now = isPro(after);
  if (was === now) return 0;
  return applyTierVisibility(db, businessId, now);
}

/**
 * Sahibi (ya da düzenleme yetkili yetkilisi) Ücretsiz kademede hangi gönderinin görüneceğini seçer: gizli bir gönderiyi
 * "Göster" derse sınır doluysa en eski görünen gizlenir; "Gizle" derse yer açılır.
 */
export async function handleTierVisibilityChoice(db: Firestore, uid: string, data: unknown): Promise<void> {
  const { postId, visible } = (data ?? {}) as { postId?: unknown; visible?: unknown };
  if (typeof postId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(postId) || typeof visible !== 'boolean') throw new TierVisibilityError('gecersiz');
  const post = await db.doc(`posts/${postId}`).get();
  const businessId = post.get('business.id');
  if (!post.exists || typeof businessId !== 'string' || post.get('status') !== 'aktif') throw new TierVisibilityError('yok');
  const biz = await db.doc(`businesses/${businessId}`).get();
  if (!biz.exists) throw new TierVisibilityError('yok');
  const team = biz.get('ownerUid') === uid || biz.get(`managers.${uid}.edit`) === true;
  if (!team) throw new TierVisibilityError('yetki');
  if (isPro(biz.data())) throw new TierVisibilityError('pro');

  if (!visible) {
    await post.ref.update({ tierHidden: true });
    return;
  }
  if (post.get('tierHidden') !== true) return;
  const limit = await freePostLimit(db);
  const shown = (await activePosts(db, businessId)).filter((p) => p.get('tierHidden') !== true);
  const updates: { ref: FirebaseFirestore.DocumentReference; data: DocumentData }[] = [{ ref: post.ref, data: { tierHidden: FieldValue.delete() } }];
  // En eskiden başlayarak sınırın altına inene kadar gizle.
  for (let i = shown.length - 1; i >= 0 && shown.length - (updates.length - 1) >= limit; i--) updates.push({ ref: shown[i].ref, data: { tierHidden: true } });
  await commitUpdates(db, updates);
}

/**
 * Günlük: Pro'su 2-3 gün içinde bitecek ve yenilenmeyecek (iptal edilmiş ya da elle verilmiş) işletmelerin sahibine
 * "Pro'n bitiyor" bildirimi. Pencere bir gün olduğu için her işletmeye bir kez gider.
 */
export async function remindProEnding(db: Firestore, deps: NotifyDeps): Promise<number> {
  const from = Timestamp.fromMillis(deps.now.getTime() + 2 * 86_400_000);
  const to = Timestamp.fromMillis(deps.now.getTime() + 3 * 86_400_000);
  const snap = await db.collection('businesses').where('membership.tier', '==', 'pro').where('membership.endsAt', '>=', from).where('membership.endsAt', '<', to).limit(400).get();
  let sent = 0;
  for (const d of snap.docs) {
    if (d.get('membership.autoRenew') === true) continue;
    const owner = d.get('ownerUid');
    if (typeof owner !== 'string') continue;
    sent += await notifyUsers(
      db,
      [owner],
      { kind: 'proEnding', category: 'mesaj', title: String(d.get('name') ?? ''), href: { pathname: '/business/membership', params: { id: d.id } } },
      deps,
    );
  }
  return sent;
}
