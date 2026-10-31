import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { GENERAL_CHANNEL_ID, SOS_CHANNEL_ID, sosPushMessages, type LanguageCode, type PushMessage, type PushNotice, type SosAlert } from '@cityjoy/shared';

import i18n from './i18n';
import { pushTokenRepository } from './services';

/**
 * SOS bildirimleri (Expo push). Bildirimi, SOS'u gönderen kişinin telefonu aile üyelerinin telefonlarına
 * yollar; sunucu gerekmez. Telefon başka uygulamadayken ya da ekran kilitliyken de görünür ve çalar.
 * Web sürümünde ve EAS proje kimliği olmadan (geliştirme derlemesi öncesi) sessizce atlanır.
 */
export const pushSupported = Platform.OS !== 'web';

type Href = PushNotice['href'];

let currentToken: string | null = null;

// Ekranda açık olan sohbet ("karşıdaki|sohbet"): o sohbetin mesaj bildirimi uygulama açıkken gösterilmez.
let openChat: string | null = null;
const chatKey = (uid: string, thread?: string) => `${uid}|${thread ?? ''}`;
export function setOpenChat(uid: string | null, thread?: string) {
  openChat = uid ? chatKey(uid, thread) : null;
}

if (pushSupported) {
  // Uygulama açıkken gelen SOS da sesli ve görünür olsun; yalnızca o an açık sohbetin mesajı gösterilmez.
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const href = (n.request.content.data as { href?: Href } | undefined)?.href;
      const inChat = href?.pathname === '/messages/[uid]' && !!openChat && openChat === chatKey(href.params?.uid ?? '', href.params?.thread);
      return { shouldShowBanner: !inChat, shouldShowList: !inChat, shouldPlaySound: !inChat, shouldSetBadge: false };
    },
  });
}

function projectId(): string | undefined {
  return (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/** Android: SOS için en yüksek öncelikli, sesli ve titreşimli, kilit ekranında görünen kanal. */
async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(SOS_CHANNEL_ID, {
    name: 'SOS',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 600, 300, 600, 300, 600],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  });
  // Sunucunun gönderdiği olay bildirimleri (etkinlik iptali vb.).
  await Notifications.setNotificationChannelAsync(GENERAL_CHANNEL_ID, {
    name: i18n.t('notifications.push.channel'),
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });
}

export async function notificationPermission(): Promise<'granted' | 'denied' | 'undetermined' | 'unsupported'> {
  if (!pushSupported) return 'unsupported';
  return (await Notifications.getPermissionsAsync()).status;
}

/** Bildirim izni ister ve bu telefonun adresini kaydeder. Döndürdüğü: izin durumu. */
export async function registerForPush(uid: string, language: LanguageCode, ask: boolean): Promise<'granted' | 'denied' | 'undetermined' | 'unsupported'> {
  if (!pushSupported || !Device.isDevice) return 'unsupported';
  try {
    await ensureChannel();
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && ask) status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return status;
    const id = projectId();
    if (!id) return 'unsupported';
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    currentToken = token;
    await pushTokenRepository.save(uid, token, language);
    return 'granted';
  } catch {
    return 'undetermined';
  }
}

/** Çıkışta: bu telefona artık başkasının SOS'u gitmesin. */
export async function unregisterPush(uid: string) {
  if (currentToken) await pushTokenRepository.remove(uid, currentToken).catch(() => {});
  currentToken = null;
}

async function post(messages: PushMessage[]) {
  for (let i = 0; i < messages.length; i += 100) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
  }
}

/**
 * SOS ya da "Güvendeyim" bildirimini aile üyelerine yollar. Bildirim alamayacak (telefonu kayıtlı
 * olmayan) üyelerin kimliklerini döndürür; ekran onları "arayın" diye gösterir.
 */
export async function sendSosPush(alert: Pick<SosAlert, 'id' | 'fromName' | 'test' | 'recipients'>, kind: 'yardim' | 'guvende'): Promise<string[]> {
  const targets = await pushTokenRepository.forUsers(alert.recipients).catch(() => []);
  const reachable = targets.filter((tg) => tg.tokens.length);
  const messages = sosPushMessages(reachable, alert, kind);
  if (messages.length) await post(messages).catch(() => {});
  const ok = new Set(reachable.map((tg) => tg.uid));
  return alert.recipients.filter((uid) => !ok.has(uid));
}

/** Sunucu bildirimlerinin açabileceği ekranlar (bildirimdeki adres yalnızca bunlardan biri olabilir). */
const TAP_PATHS = new Set(['/events/[id]', '/activities/[id]', '/announcements/[id]', '/messages/[uid]', '/u/[uid]', '/me']);

/** Bildirime dokununca ilgili ekran açılır: SOS ya da sunucu bildiriminin gösterdiği ekran. */
export function onNotificationTap(open: (href: Href) => void): () => void {
  if (!pushSupported) return () => {};
  const handle = (r: Notifications.NotificationResponse | null) => {
    const data = r?.notification.request.content.data as { sosId?: string; href?: Href } | undefined;
    if (typeof data?.sosId === 'string') open({ pathname: '/sos/[id]', params: { id: data.sosId } });
    else if (data?.href && TAP_PATHS.has(data.href.pathname)) open(data.href);
  };
  Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
