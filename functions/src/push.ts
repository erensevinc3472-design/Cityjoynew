import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  noticePriority,
  noticePushMessages,
  noticeRecipients,
  normalizeNotificationSettings,
  normalizePrefs,
  turkeyHour,
  type LanguageCode,
  type NoticePushMessage,
  type NoticeTarget,
  type PushNotice,
} from '@cityjoy/shared';

/** Expo bildirim servisine gönderir; artık geçersiz olan telefon adreslerini döndürür. Testte sahtesi verilir. */
export type PushSender = (messages: NoticePushMessage[]) => Promise<string[]>;

export interface NotifyDeps {
  send: PushSender;
  now: Date;
}

/** Gerçek gönderici: 100 iletilik paketler. Expo "DeviceNotRegistered" derse o adres silinsin diye geri verilir. */
export const expoSender: PushSender = async (messages) => {
  const dead: string[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) throw new Error(`Expo push ${res.status}`);
    const tickets = ((await res.json()) as { data?: { status: string; details?: { error?: string } }[] }).data ?? [];
    tickets.forEach((t, k) => {
      if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') dead.push(chunk[k].to);
    });
  }
  return dead;
};

/**
 * Günlük sesli tavan: "normal" öncelikli bildirimde kişinin bugünkü (Türkiye günü) sesli sayısı artar; tavanı dolmuş
 * olanlar döner (onlara sessiz gider). Sayaç `pushCount/{uid}`: { day, count }.
 */
async function spendSound(db: Firestore, uids: readonly string[], cap: number, now: Date): Promise<Set<string>> {
  const day = new Date(now.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
  const silent = new Set<string>();
  for (let i = 0; i < uids.length; i += 400) {
    const part = uids.slice(i, i + 400);
    const docs = await db.getAll(...part.map((uid) => db.doc(`pushCount/${uid}`)));
    const batch = db.batch();
    part.forEach((uid, k) => {
      const count = docs[k].get('day') === day ? ((docs[k].get('count') as number | undefined) ?? 0) : 0;
      if (count >= cap) silent.add(uid);
      else batch.set(docs[k].ref, { day, count: count + 1 });
    });
    await batch.commit();
  }
  return silent;
}

/**
 * Kişilere olay bildirimi: telefon adresleri, dil ve kişinin tercihleri okunur, admin'in kapattığı türler ve sessiz
 * saatler (Türkiye saati) gözetilir. Öncelik panelden: "uygulama içi" telefona gitmez, "normal" günlük sesli tavandan
 * sonra sessiz gider, "her zaman" (acil, SOS, admin'in işaretlediği) hep çalar. Telefonu kayıtlı olmayan kişi atlanır.
 * Gönderilen ileti sayısını döndürür.
 */
export async function notifyUsers(db: Firestore, uids: readonly string[], notice: PushNotice, deps: NotifyDeps): Promise<number> {
  const unique = [...new Set(uids)];
  if (!unique.length) return 0;
  // Tetikleyiciler belgenin `triggers` alanında (panel öyle kaydeder).
  const settings = normalizeNotificationSettings((await db.doc('config/notificationTriggers').get()).data());
  const { triggers } = settings;
  if (!triggers[notice.category]) return 0;
  const priority = noticePriority(notice, settings.priorities);
  if (priority === 'inapp') return 0;

  const targets: NoticeTarget[] = [];
  for (let i = 0; i < unique.length; i += 100) {
    const part = unique.slice(i, i + 100);
    const [tokenDocs, prefDocs] = await Promise.all([
      db.getAll(...part.map((uid) => db.doc(`pushTokens/${uid}`))),
      db.getAll(...part.map((uid) => db.doc(`users/${uid}/settings/notifications`))),
    ]);
    part.forEach((uid, k) => {
      const tokens = (tokenDocs[k].get('tokens') as string[] | undefined) ?? [];
      if (!tokens.length) return;
      const language = (tokenDocs[k].get('language') as LanguageCode | undefined) ?? 'tr';
      targets.push({ uid, tokens, language, prefs: normalizePrefs(prefDocs[k].data()) });
    });
  }

  const hour = turkeyHour(deps.now);
  const recipients = noticeRecipients(targets, notice, triggers, hour);
  const silent = priority === 'normal' ? await spendSound(db, recipients.map((t) => t.uid), settings.dailySoundCap, deps.now) : new Set<string>();
  const messages = noticePushMessages(recipients, notice, triggers, hour, silent);
  if (!messages.length) return 0;
  const dead = new Set(await deps.send(messages));
  if (dead.size) {
    await Promise.all(
      targets
        .filter((t) => t.tokens.some((x) => dead.has(x)))
        .map((t) => db.doc(`pushTokens/${t.uid}`).update({ tokens: FieldValue.arrayRemove(...t.tokens.filter((x) => dead.has(x))) })),
    );
  }
  return messages.length;
}
