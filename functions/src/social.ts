import { Timestamp, type DocumentData, type Firestore } from 'firebase-admin/firestore';

import { notifyUsers, type NotifyDeps } from './push';

/** Bildirimde mesajın en çok bu kadarı görünür. */
const PREVIEW = 150;
/** Takip et / bırak / yeniden takip et ile aynı kişiye üst üste bildirim gitmesin: bir takip için 7 günde bir. */
const FOLLOW_REPEAT_DAYS = 7;

const preview = (text: string) => (text.length > PREVIEW ? `${text.slice(0, PREVIEW - 1)}…` : text);
const other = (members: string[], uid: string) => (members[0] === uid ? members[1] : members[0]);

/** İşletmeye yazılan sohbette mesaj izni olan yetkililer (sahip sohbetin üyesidir, burada sayılmaz). */
async function messageStaff(db: Firestore, businessId: string): Promise<string[]> {
  const b = (await db.doc(`businesses/${businessId}`).get()).data();
  const managers = (b?.managers ?? {}) as Record<string, { messages?: boolean }>;
  return ((b?.managerUids ?? []) as string[]).filter((uid) => managers[uid]?.messages === true);
}

/**
 * Yeni mesajda alıcıya telefon bildirimi (PROJE.md 5.11, 5.12): başlıkta gönderenin adı (işletme adına yazılan cevapta
 * işletmenin adı; işletme ve ilan sohbetinde yanında işletme ya da ilan), gövdede mesajın başı. Müşteri işletmeye
 * yazınca sahip ve mesaj izni olan yetkililer de alır. Mesaj isteğinde (takipleşmeyen iki kişi) metin gösterilmez ve
 * yalnızca ilk mesajda gider; kabul edilmeden yazılan sonraki mesajlar bildirim yağdırmaz.
 */
export async function handleMessageCreate(db: Firestore, chatId: string, message: DocumentData | undefined, deps: NotifyDeps): Promise<number> {
  if (!message || message.status !== 'aktif' || typeof message.from !== 'string') return 0;
  const chat = (await db.doc(`chats/${chatId}`).get()).data();
  if (!chat) return 0;
  const from = message.from as string;
  const members = chat.members as string[];
  const context = chat.context as { type: 'isletme' | 'ilan'; id: string; title: string } | undefined;
  const isMember = members.includes(from);
  // Üye olmayan gönderen yalnızca işletme yetkilisi olabilir (kurallar).
  if (!isMember && context?.type !== 'isletme') return 0;

  const recipients = isMember ? [other(members, from)] : [chat.startedBy as string];
  if (isMember && context?.type === 'isletme' && from === chat.startedBy) recipients.push(...(await messageStaff(db, context.id)));
  const targets = recipients.filter((uid) => uid !== from);
  if (!targets.length) return 0;

  const href = {
    pathname: '/messages/[uid]',
    // Alıcı tarafında karşıdaki kişi: üye yazdıysa o, yetkili yazdıysa işletmenin sahibi.
    params: { uid: isMember ? from : other(members, chat.startedBy), ...(context ? { thread: chatId } : {}) },
  };
  const name = String(chat.names?.[from] ?? '?');

  if (!context && chat.accepted === false && from === chat.startedBy) {
    if ((chat.unread?.[targets[0]] ?? 0) > 1) return 0;
    return notifyUsers(db, targets, { kind: 'messageRequest', category: 'mesaj', title: name, href }, deps);
  }
  const businessSide = context?.type === 'isletme' && from !== chat.startedBy;
  const title = businessSide ? context.title : context ? `${name} · ${context.title}` : name;
  return notifyUsers(db, targets, { kind: 'message', category: 'mesaj', title, body: preview(String(message.text ?? '')), href }, deps);
}

/** Aynı olay için kısa sürede ikinci bildirimi önler; kayıt `deleteAt` geçince günlük temizlikte silinir. */
async function firstWithin(db: Firestore, key: string, days: number, now: Date): Promise<boolean> {
  const ref = db.doc(`pushLog/${key}`);
  return db.runTransaction(async (tx) => {
    const prev = (await tx.get(ref)).get('deleteAt') as Timestamp | undefined;
    if (prev && prev.toMillis() > now.getTime()) return false;
    tx.set(ref, { at: Timestamp.fromDate(now), deleteAt: Timestamp.fromMillis(now.getTime() + days * 86_400_000) });
    return true;
  });
}

async function displayName(db: Firestore, uid: string): Promise<string> {
  return String((await db.doc(`publicProfiles/${uid}`).get()).get('displayName') ?? '?');
}

/**
 * Takipte telefon bildirimi: yeni takipçi ve takip isteği hesap sahibine, isteğin kabulü isteyene. Takip bırakılıp
 * yeniden edilirse aynı bildirim 7 gün içinde tekrar gitmez.
 */
export async function handleFollowWrite(
  db: Firestore,
  fid: string,
  before: DocumentData | undefined,
  after: DocumentData | undefined,
  deps: NotifyDeps,
): Promise<number> {
  if (!after) return 0;
  const follower = after.followerUid as string;
  const followee = after.followeeUid as string;
  if (!before) {
    if (after.status !== 'aktif' && after.status !== 'istek') return 0;
    const request = after.status === 'istek';
    if (!(await firstWithin(db, `takip_${fid}`, FOLLOW_REPEAT_DAYS, deps.now))) return 0;
    return notifyUsers(
      db,
      [followee],
      {
        kind: request ? 'followRequest' : 'follower',
        category: 'takip',
        title: await displayName(db, follower),
        // Gelen istekler kişinin kendi profilinde kabul edilir.
        href: request ? { pathname: '/me' } : { pathname: '/u/[uid]', params: { uid: follower } },
      },
      deps,
    );
  }
  if (before.status !== 'istek' || after.status !== 'aktif') return 0;
  if (!(await firstWithin(db, `takipkabul_${fid}`, FOLLOW_REPEAT_DAYS, deps.now))) return 0;
  return notifyUsers(
    db,
    [follower],
    { kind: 'followAccepted', category: 'takip', title: await displayName(db, followee), href: { pathname: '/u/[uid]', params: { uid: followee } } },
    deps,
  );
}
