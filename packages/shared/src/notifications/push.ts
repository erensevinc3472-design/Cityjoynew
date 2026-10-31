import type { LanguageCode } from '../i18n/languages';
import { translations } from '../i18n/resources';
import { CRITICAL_CATEGORIES, quietAtHour, type NotificationCategory, type NotificationPrefs, type NotificationTriggers } from './notifications';

/** Android'de SOS dışındaki bildirimlerin kanalı (uygulama açılışta kurar). */
export const GENERAL_CHANNEL_ID = 'genel';

/**
 * Sunucunun gönderdiği olay bildirimleri; metinler dil dosyasında `notifications.push` altında. Duyuruda başlık
 * türe göredir ("Acil duyuru · Nilüfer Belediyesi"), gövde duyurunun kendi başlığıdır (yazıldığı dilde).
 */
export type PushNoticeKind =
  | 'eventCancelled'
  | 'activityCancelled'
  | 'announcement'
  | 'message'
  | 'messageRequest'
  | 'follower'
  | 'followRequest'
  | 'followAccepted';

export interface PushNotice {
  kind: PushNoticeKind;
  category: NotificationCategory;
  /** Metne yerleşen ad (etkinlik / aktivite adı, duyuruda yayınlayan, mesajda ve takipte kişinin adı). */
  title: string;
  /** Hazır gövde (duyurunun başlığı, mesajın kendisi); yoksa dil dosyasındaki metin. */
  body?: string;
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
  /** Acil duyuruda: hemen teslim edilir, iOS odak modunda da görünür. */
  priority?: 'high';
  interruptionLevel?: 'time-sensitive';
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
    const push = (translations[target.language] ?? translations.tr).notifications.push as Record<string, string>;
    const key = notice.kind === 'announcement' ? notice.category : notice.kind;
    const title = push[`${key}Title`].replace('{{title}}', notice.title);
    const body = notice.body ?? push[`${key}Body`].replace('{{title}}', notice.title);
    return [...new Set(target.tokens)].map((to) => ({
      to,
      title,
      body,
      data: { href: notice.href },
      sound: 'default' as const,
      channelId: GENERAL_CHANNEL_ID,
      ttl: 86400,
      ...(critical ? { priority: 'high' as const, interruptionLevel: 'time-sensitive' as const } : {}),
    }));
  });
}
