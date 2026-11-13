import { FieldValue, Timestamp, type DocumentData, type Firestore } from 'firebase-admin/firestore';
import { POST_LIMITS, TAG_POLICIES, type TagPolicy } from '@cityjoy/shared';

import { notifyUsers, type NotifyDeps } from './push';

/**
 * Gönderide etiketleme (Eren, 13 Kasım 2026). Paylaşan `tagReq` ile ister; sunucu her kişi için denetler:
 * hesap var ve askıda değil, iki yönde engel yok, kişinin "Beni kim etiketleyebilir" ayarı izin veriyor ("takip":
 * etiketlenen kişi paylaşanı takip ediyor). Uygunlar `tags` ve `tagNames` alanına yazılır, `tagReq` silinir ve
 * gönderi yayındaysa etiketlenenlere bildirim gider. Döner: onaylanan kişi sayısı.
 */
export async function handlePostTags(db: Firestore, postId: string, post: DocumentData | undefined, deps: NotifyDeps): Promise<number> {
  const req = post?.tagReq;
  if (!post || !Array.isArray(req)) return 0;
  const author = String(post.authorUid ?? '');
  const wanted = [...new Set(req.filter((u): u is string => typeof u === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(u) && u !== author))].slice(0, POST_LIMITS.tags);
  const ok: { uid: string; name: string }[] = [];
  for (const uid of wanted) {
    const [profile, privacy, blockA, blockB, follow] = await db.getAll(
      db.doc(`publicProfiles/${uid}`),
      db.doc(`users/${uid}/settings/privacy`),
      db.doc(`blocks/${uid}_${author}`),
      db.doc(`blocks/${author}_${uid}`),
      db.doc(`follows/${uid}_${author}`),
    );
    if (!profile.exists || profile.get('suspended') === true || blockA.exists || blockB.exists) continue;
    const raw = privacy.get('tagPolicy');
    const policy: TagPolicy = (TAG_POLICIES as readonly string[]).includes(raw) ? raw : 'herkes';
    if (policy === 'kimse' || (policy === 'takip' && follow.get('status') !== 'aktif')) continue;
    ok.push({ uid, name: String(profile.get('displayName') ?? '?').slice(0, 40) });
  }
  await db.doc(`posts/${postId}`).update({
    tagReq: FieldValue.delete(),
    ...(ok.length ? { tags: ok.map((x) => x.uid), tagNames: Object.fromEntries(ok.map((x) => [x.uid, x.name])) } : {}),
  });
  if (ok.length && post.status === 'aktif') {
    await notifyUsers(
      db,
      ok.map((x) => x.uid),
      { kind: 'tagged', category: 'takip', title: String(post.authorName || '?'), href: { pathname: '/explore/[id]', params: { id: postId } } },
      deps,
    );
  }
  return ok.length;
}

/** Hesap silinince kişi başkalarının gönderilerindeki etiketlerden çıkarılır. */
export async function removeTagsOf(db: Firestore, uid: string): Promise<number> {
  const snap = await db.collection('posts').where('tags', 'array-contains', uid).limit(500).get();
  await Promise.all(snap.docs.map((d) => d.ref.update({ tags: FieldValue.arrayRemove(uid), [`tagNames.${uid}`]: FieldValue.delete() })));
  return snap.size;
}

/** Bir çağrıda en çok bu kadar gönderi; kişi başına günde en çok bu kadar izlenme sayılır. */
export const VIEW_LIMITS = { perCall: 50, perDay: 2000 } as const;

export class ViewError extends Error {
  constructor(readonly code: 'gecersiz') {
    super(code);
  }
}

/** Türkiye takvimine göre gün (izlenme kaydı günlüktür). */
const turkeyDay = (now: Date) => new Date(now.getTime() + 3 * 3600_000).toISOString().slice(0, 10).replace(/-/g, '');

/**
 * Video izlenmeleri (telefon toplu gönderir; en az 3 sn izlenenler). Aynı kişi aynı videoyu günde bir kez sayılır
 * (`viewLog/{uid}_{gün}`; iki gün sonra günlük temizlikte silinir). Kendi videosu, kaldırılmış ya da videosuz gönderi
 * sayılmaz. Maliyet: çağrı başına bir okuma + bir yazma, sayılan her video için bir yazma. Döner: sayılan sayı.
 */
export async function handleRecordViews(db: Firestore, uid: string, data: unknown, now: Date): Promise<number> {
  const raw = (data as { ids?: unknown } | null)?.ids;
  if (!Array.isArray(raw) || raw.length > VIEW_LIMITS.perCall) throw new ViewError('gecersiz');
  const ids = [...new Set(raw.filter((x): x is string => typeof x === 'string' && /^[A-Za-z0-9]{1,64}$/.test(x)))];
  if (!ids.length) return 0;
  const logRef = db.doc(`viewLog/${uid}_${turkeyDay(now)}`);
  return db.runTransaction(async (tx) => {
    const log = await tx.get(logRef);
    const seen = new Set<string>((log.get('ids') as string[] | undefined) ?? []);
    const fresh = ids.filter((id) => !seen.has(id)).slice(0, Math.max(0, VIEW_LIMITS.perDay - seen.size));
    if (!fresh.length) return 0;
    const posts = await tx.getAll(...fresh.map((id) => db.doc(`posts/${id}`)));
    const counted = posts.filter((p) => p.exists && p.get('status') === 'aktif' && p.get('video') && p.get('authorUid') !== uid);
    counted.forEach((p) => tx.update(p.ref, { viewCount: FieldValue.increment(1) }));
    // Sayılmayanlar da kayda girer: aynı gün tekrar denenmez.
    tx.set(logRef, { ids: [...seen, ...fresh], deleteAt: Timestamp.fromMillis(now.getTime() + 2 * 86400_000) });
    return counted.length;
  });
}
