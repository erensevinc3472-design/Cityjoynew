import type { LanguageCode } from '../i18n/languages';
import { translations } from '../i18n/resources';
import { CRITICAL_CATEGORIES, quietAtHour, type NotificationCategory, type NotificationPrefs, type NotificationTriggers } from './notifications';

/** Android'de SOS dışındaki bildirimlerin kanalı (uygulama açılışta kurar). */
export const GENERAL_CHANNEL_ID = 'genel';

/** Sunucunun gönderdiği olay bildirimleri; metinler dil dosyasında `notifications.push` altında. */
export type PushNoticeKind = 'eventCancelled' | 'activityCancelled';

export interface PushNotice {
  kind: PushNoticeKind;
  category: NotificationCategory;
  /** Metne yerleşen başlık (etkinlik / aktivite adı). */
  title: string;
  /** Dokununca açılacak ekran. */
  href: { pathname: string; params?: Record<string, string> };
}

/** Bir alıcı: telefonları, dili ve kendi bildirim tercihleri. */
export interface NoticeTarget {
  uid: string;
  tokens: string[];
  language: LanguageCode;
  prefs: NotificationPrefs;
}

export interface NoticePushMessage {
  to: string;
  title: string;
  body: string;
  data: { href: PushNotice['href'] };
  sound: 'default';
  channelId: string;
  /** Saniye: bir günden eski bildirim teslim edilmez. */
  ttl: number;
}

/**
 * Olay bildirimini alıcıların kendi dilinde hazırlar. Admin'in kapattığı türler (panel) ve kişinin kapattığı türler
 * gitmez; sessiz saatte yalnızca kritik türler (acil, SOS) gider. `hour`: Türkiye saati.
 */
export function noticePushMessages(targets: readonly NoticeTarget[], notice: PushNotice, triggers: NotificationTriggers, hour: number): NoticePushMessage[] {
  if (!triggers[notice.category]) return [];
  const critical = CRITICAL_CATEGORIES.includes(notice.category);
  return targets.flatMap((target) => {
    if (!target.prefs.categories[notice.category]) return [];
    if (!critical && quietAtHour(target.prefs.quietHours, hour)) return [];
    const push = (translations[target.language] ?? translations.tr).notifications.push;
    const title = push[`${notice.kind}Title`];
    const body = push[`${notice.kind}Body`].replace('{{title}}', notice.title);
    return [...new Set(target.tokens)].map((to) => ({
      to,
      title,
      body,
      data: { href: notice.href },
      sound: 'default' as const,
      channelId: GENERAL_CHANNEL_ID,
      ttl: 86400,
    }));
  });
}
