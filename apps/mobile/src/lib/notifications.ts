import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  collectNotifications,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_NOTIFICATION_TRIGGERS,
  isRecent,
  isRequestFor,
  otherMember,
  type AppNotification,
  type NotificationPrefs,
  type NotificationTriggers,
  type ReadState,
} from '@cityjoy/shared';
import { createNotificationSettings, createNotificationTriggers } from '@cityjoy/shared/firebase';

import { useAnnouncements } from './announcements';
import { useEvents } from './events';
import { firestore } from './firebase';
import { isFirebaseConfigured } from './firebase-config';
import { useIncomingSos } from './incoming-sos';
import { chatHref, useChats } from './messages';
import { socialRepository } from './services';
import { useSession } from './session';
import { deviceStorage } from './storage';
import { useUserLocation } from './user-location';

export const notificationSettings = createNotificationSettings(firestore);

// ---- Tercihler (kişinin özel belgesi) ve panel tetikleyicileri: oturum başına bir okuma ----

let prefsState: { uid: string; prefs: NotificationPrefs } | null = null;
let triggersLoad: Promise<NotificationTriggers> | null = null;
let triggers: NotificationTriggers | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

function useStore() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
}

export function useNotificationPrefs(): { prefs: NotificationPrefs; triggers: NotificationTriggers; ready: boolean; save(p: NotificationPrefs): Promise<void> } {
  useStore();
  const { user } = useSession();
  const uid = user?.uid;
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    triggersLoad ??= createNotificationTriggers(firestore).get().then(
      (t) => {
        triggers = t;
        notify();
        return t;
      },
      () => {
        triggersLoad = null;
        return DEFAULT_NOTIFICATION_TRIGGERS;
      },
    );
    if (!uid || prefsState?.uid === uid) return;
    notificationSettings.get(uid).then((prefs) => {
      prefsState = { uid, prefs };
      notify();
    }, () => {});
  }, [uid]);
  const save = useCallback(
    async (p: NotificationPrefs) => {
      if (!uid) return;
      const before = prefsState;
      prefsState = { uid, prefs: p };
      notify();
      try {
        await notificationSettings.save(uid, p);
      } catch (e) {
        prefsState = before;
        notify();
        throw e;
      }
    },
    [uid],
  );
  const mine = prefsState && prefsState.uid === uid ? prefsState.prefs : null;
  return { prefs: mine ?? DEFAULT_NOTIFICATION_PREFS, triggers: triggers ?? DEFAULT_NOTIFICATION_TRIGGERS, ready: !!mine, save };
}

// ---- Okundu bilgisi (telefonda) ----

const READ_KEY = 'notifications:read:v1';
let read: ReadState | null = null;

function setRead(next: ReadState) {
  read = next;
  deviceStorage.set(READ_KEY, JSON.stringify(next));
  notify();
}

export function useReadState(): [ReadState, (next: ReadState) => void] {
  useStore();
  useEffect(() => {
    if (read) return;
    deviceStorage.get(READ_KEY).then((raw) => {
      try {
        const v = raw ? (JSON.parse(raw) as ReadState) : null;
        read = v && Array.isArray(v.ids) ? { until: typeof v.until === 'string' ? v.until : null, ids: v.ids.filter((x) => typeof x === 'string') } : { until: null, ids: [] };
      } catch {
        read = { until: null, ids: [] };
      }
      notify();
    });
  }, []);
  return [read ?? { until: null, ids: [] }, setRead];
}

// ---- Bildirim akışı ----

/**
 * Bildirimler, kişinin zaten okuduğu kaynaklardan toplanır. Ana sayfadaki zil için hafif sürüm (full = false):
 * duyurular (ana sayfa zaten okur), gelen SOS ve mesajlar. Bildirim ekranında etkinlikler ve yeni takipçiler de
 * okunur (yalnızca ekran açıkken).
 */
export function useNotificationFeed(full: boolean): AppNotification[] | null {
  const { t } = useTranslation();
  const { user } = useSession();
  const { location } = useUserLocation();
  const { prefs, triggers } = useNotificationPrefs();
  const { list: announcements } = useAnnouncements(location, 'hepsi');
  const sos = useIncomingSos();
  const { chats } = useChats(user?.uid);
  const { list: events } = useEvents(full ? location?.provinceCode : undefined);
  const [followers, setFollowers] = useState<{ uid: string; displayName: string; at: string }[] | null>(full ? null : []);

  useEffect(() => {
    if (!full || !user) return;
    socialRepository.recentFollowers(user.uid).then(setFollowers, () => setFollowers([]));
  }, [full, user]);

  if (!user) return [];
  const me = user.uid;
  const items: AppNotification[] = [];
  for (const a of announcements ?? []) {
    items.push({
      id: `duyuru:${a.id}`,
      category: a.kind === 'acil' ? 'acil' : a.kind === 'haber' ? 'haber' : 'duyuru',
      title: a.title,
      // Kurum adı; muhtar ve il yöneticisi duyurusunda ad ayrıntıda görünür.
      body: a.author.type === 'kurum' ? a.author.name : undefined,
      at: a.publishedAt ?? a.createdAt,
      href: { pathname: '/announcements/[id]', params: { id: a.id } },
    });
  }
  for (const s of sos) {
    if (!isRecent(s)) continue;
    items.push({
      id: `sos:${s.id}`,
      category: 'sos',
      title: s.test ? t('sos.incomingTest', { name: s.fromName }) : t('sos.incomingTitle', { name: s.fromName }),
      at: s.createdAt,
      href: { pathname: '/sos/[id]', params: { id: s.id } },
    });
  }
  for (const c of chats ?? []) {
    if (!c.last || c.last.from === me || !(c.unread[me] ?? 0)) continue;
    const other = otherMember(c, me);
    const name = c.names[other] ?? '?';
    items.push({
      id: `mesaj:${c.id}:${c.last.id}`,
      category: 'mesaj',
      title: isRequestFor(c, me) ? t('notifications.messageRequest', { name }) : t('notifications.message', { name, count: c.unread[me] }),
      body: c.last.text || undefined,
      at: c.last.at,
      href: chatHref(c, me),
    });
  }
  for (const e of full ? (events ?? []) : []) {
    items.push({
      id: `etkinlik:${e.id}`,
      category: 'etkinlik',
      title: t('notifications.event', { title: e.title }),
      body: e.venueName,
      at: e.publishedAt ?? e.createdAt,
      href: { pathname: '/events/[id]', params: { id: e.id } },
    });
  }
  for (const f of followers ?? []) {
    items.push({ id: `takip:${f.uid}:${f.at}`, category: 'takip', title: t('notifications.follower', { name: f.displayName }), at: f.at, href: { pathname: '/u/[uid]', params: { uid: f.uid } } });
  }
  // Ekranda kaynaklardan biri hâlâ yükleniyorsa ve hiç öğe yoksa "yükleniyor".
  const loading = announcements === null || chats === null || (full && (events === null || followers === null));
  const list = collectNotifications(items, prefs, triggers);
  return loading && !list.length ? null : list;
}
