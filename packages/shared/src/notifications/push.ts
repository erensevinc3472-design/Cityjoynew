import type { LanguageCode } from '../i18n/languages';
import { translations } from '../i18n/resources';
import {
  CRITICAL_CATEGORIES,
  quietAtHour,
  type NotificationCategory,
  type NotificationPrefs,
  type NotificationPriorities,
  type NotificationPriority,
  type NotificationTriggers,
  type PriorityKey,
} from './notifications';

/** Android'de SOS dışındaki bildirimlerin kanalı (uygulama açılışta kurar). */
export const GENERAL_CHANNEL_ID = 'genel';
/** Günlük sesli tavan dolunca: sessiz kanal (bildirim listesinde görünür, çalmaz). */
export const QUIET_CHANNEL_ID = 'sessiz';

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
  /** Duyuruda yayınlayan: kurum ya da kişi (muhtar, il yöneticisi); öncelik buna göre. */
  source?: 'kurum' | 'kisi';
  /** Admin onayda "her zaman çalsın" dediyse. */
  ringAlways?: boolean;
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
  /** Yoksa sessiz gelir (günlük sesli tavan doldu). */
  sound?: 'default';
  channelId: string;
  /** Saniye: bir günden eski bildirim teslim edilmez. */
  ttl: number;
  /** Acil duyuruda: hemen teslim edilir, iOS odak modunda da görünür. */
  priority?: 'high';
  interruptionLevel?: 'time-sensitive';
}

/** Bildirimin önceliği: acil ve SOS her zaman; admin işaretlediyse her zaman; değilse panelde türün seçimi. */
export function noticePriority(notice: PushNotice, priorities: NotificationPriorities): NotificationPriority {
  if (CRITICAL_CATEGORIES.includes(notice.category) || notice.ringAlways) return 'always';
  const key: PriorityKey | null =
    notice.category === 'duyuru' ? (notice.source === 'kurum' ? 'kurum-duyuru' : 'muhtar-duyuru') : notice.category === 'sos' || notice.category === 'acil' ? null : notice.category;
  return key ? priorities[key] : 'always';
}

/**
 * Bildirimi alacak kişiler: admin'in kapattığı türler (panel) ve kişinin kapattığı türler gitmez; sessiz saatte
 * yalnızca kritik türler (acil, SOS) gider. `hour`: Türkiye saati.
 */
export function noticeRecipients(targets: readonly NoticeTarget[], notice: PushNotice, triggers: NotificationTriggers, hour: number): NoticeTarget[] {
  if (!triggers[notice.category]) return [];
  const critical = CRITICAL_CATEGORIES.includes(notice.category);
  return targets.filter((target) => target.prefs.categories[notice.category] && (critical || !quietAtHour(target.prefs.quietHours, hour)));
}

/**
 * Olay bildirimini alıcıların kendi dilinde hazırlar (alıcılar `noticeRecipients` ile süzülür). `silent`: günlük
 * sesli tavanı dolmuş kişiler; onlara sessiz kanaldan, çalmadan gider.
 */
export function noticePushMessages(
  targets: readonly NoticeTarget[],
  notice: PushNotice,
  triggers: NotificationTriggers,
  hour: number,
  silent: ReadonlySet<string> = new Set(),
): NoticePushMessage[] {
  const critical = CRITICAL_CATEGORIES.includes(notice.category);
  return noticeRecipients(targets, notice, triggers, hour).flatMap((target) => {
    const push = (translations[target.language] ?? translations.tr).notifications.push as Record<string, string>;
    const key = notice.kind === 'announcement' ? notice.category : notice.kind;
    const title = push[`${key}Title`].replace('{{title}}', notice.title);
    const body = notice.body ?? push[`${key}Body`].replace('{{title}}', notice.title);
    const quiet = !critical && silent.has(target.uid);
    return [...new Set(target.tokens)].map((to) => ({
      to,
      title,
      body,
      data: { href: notice.href },
      ...(quiet ? {} : { sound: 'default' as const }),
      channelId: quiet ? QUIET_CHANNEL_ID : GENERAL_CHANNEL_ID,
      ttl: 86400,
      ...(critical ? { priority: 'high' as const, interruptionLevel: 'time-sensitive' as const } : {}),
    }));
  });
}
