import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  noticePushMessages,
  normalizePrefs,
  normalizeTriggers,
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
 * Kişilere olay bildirimi: telefon adresleri, dil ve kişinin tercihleri okunur, admin'in kapattığı türler ve sessiz
 * saatler (Türkiye saati) gözetilir. Telefonu kayıtlı olmayan kişi atlanır. Gönderilen ileti sayısını döndürür.
 */
export async function notifyUsers(db: Firestore, uids: readonly string[], notice: PushNotice, deps: NotifyDeps): Promise<number> {
  const unique = [...new Set(uids)];
  if (!unique.length) return 0;
  const triggers = normalizeTriggers((await db.doc('config/notificationTriggers').get()).data());
  if (!triggers[notice.category]) return 0;

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

  const messages = noticePushMessages(targets, notice, triggers, turkeyHour(deps.now));
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
