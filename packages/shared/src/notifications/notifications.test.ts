import { describe, expect, it } from 'vitest';

import {
  collectNotifications,
  GENERAL_CHANNEL_ID,
  noticePushMessages,
  turkeyHour,
  type NoticeTarget,
  type PushNotice,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_NOTIFICATION_TRIGGERS,
  inQuietHours,
  isUnread,
  markRead,
  normalizePrefs,
  normalizeTriggers,
  type AppNotification,
} from '../index';

const now = new Date('2026-10-28T12:00:00Z');
const n = (id: string, category: AppNotification['category'], daysAgo: number): AppNotification => ({
  id,
  category,
  title: id,
  at: new Date(now.getTime() - daysAgo * 86400000).toISOString(),
  href: { pathname: '/home' },
});

describe('bildirimler', () => {
  it('kapalı kategori ve 14 günden eski olay çıkar, en yeni üstte, tekrar yok', () => {
    const prefs = normalizePrefs({ categories: { etkinlik: false } });
    const list = collectNotifications([n('a', 'duyuru', 3), n('b', 'etkinlik', 1), n('c', 'mesaj', 1), n('a', 'duyuru', 3), n('d', 'haber', 20)], prefs, DEFAULT_NOTIFICATION_TRIGGERS, now);
    expect(list.map((x) => x.id)).toEqual(['c', 'a']);
  });

  it('panel tetikleyiciyi kapatırsa o tür gelmez; acil ve SOS kapatılamaz', () => {
    const triggers = normalizeTriggers({ takip: false, acil: false, sos: false });
    expect(triggers.acil && triggers.sos).toBe(true);
    expect(collectNotifications([n('t', 'takip', 0), n('s', 'acil', 0)], DEFAULT_NOTIFICATION_PREFS, triggers, now).map((x) => x.id)).toEqual(['s']);
  });

  it('bozuk tercih kaydı varsayılanla tamamlanır', () => {
    expect(normalizePrefs({ categories: { mesaj: 'evet' }, quietHours: { enabled: true, start: 40 } })).toEqual({
      categories: DEFAULT_NOTIFICATION_PREFS.categories,
      quietHours: { enabled: true, start: 22, end: 8 },
    });
  });

  it('sessiz saatler gece yarısını aşabilir', () => {
    const q = { enabled: true, start: 22, end: 8 };
    expect(inQuietHours(q, new Date(2026, 9, 28, 23))).toBe(true);
    expect(inQuietHours(q, new Date(2026, 9, 28, 7))).toBe(true);
    expect(inQuietHours(q, new Date(2026, 9, 28, 12))).toBe(false);
    expect(inQuietHours({ enabled: true, start: 13, end: 15 }, new Date(2026, 9, 28, 14))).toBe(true);
    expect(inQuietHours({ ...q, enabled: false }, new Date(2026, 9, 28, 23))).toBe(false);
  });

  it('okundu: tümünü okundu saymadan sonrakiler yeni, açılanlar okundu', () => {
    const read = { until: n('x', 'duyuru', 2).at, ids: [] };
    expect(isUnread(n('eski', 'duyuru', 3), read)).toBe(false);
    expect(isUnread(n('yeni', 'duyuru', 1), read)).toBe(true);
    expect(isUnread(n('yeni', 'duyuru', 1), markRead(read, 'yeni'))).toBe(false);
  });
});

describe('sunucu olay bildirimi', () => {
  const notice: PushNotice = { kind: 'eventCancelled', category: 'etkinlik', title: 'Kitap Günü', href: { pathname: '/events/[id]', params: { id: 'e1' } } };
  const target = (uid: string, over: Partial<NoticeTarget> = {}): NoticeTarget => ({
    uid, tokens: ['T-' + uid], language: 'tr', prefs: DEFAULT_NOTIFICATION_PREFS, ...over,
  });

  it('alıcının dilinde, başlık metne yerleşmiş olarak hazırlar; aynı telefona bir kez', () => {
    const msgs = noticePushMessages([target('a', { tokens: ['T1', 'T1'] }), target('b', { language: 'en' })], notice, DEFAULT_NOTIFICATION_TRIGGERS, 12);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toMatchObject({ to: 'T1', title: 'Etkinlik iptal edildi', channelId: GENERAL_CHANNEL_ID, data: { href: notice.href } });
    expect(msgs[0].body).toContain('"Kitap Günü"');
    expect(msgs[1].title).toBe('Event cancelled');
  });

  it('admin ya da kişi türü kapattıysa ve sessiz saatte gitmez', () => {
    const off = { ...DEFAULT_NOTIFICATION_PREFS, categories: { ...DEFAULT_NOTIFICATION_PREFS.categories, etkinlik: false } };
    const quiet = { ...DEFAULT_NOTIFICATION_PREFS, quietHours: { enabled: true, start: 22, end: 8 } };
    expect(noticePushMessages([target('a')], notice, { ...DEFAULT_NOTIFICATION_TRIGGERS, etkinlik: false }, 12)).toEqual([]);
    expect(noticePushMessages([target('a', { prefs: off })], notice, DEFAULT_NOTIFICATION_TRIGGERS, 12)).toEqual([]);
    expect(noticePushMessages([target('a', { prefs: quiet })], notice, DEFAULT_NOTIFICATION_TRIGGERS, 23)).toEqual([]);
    expect(noticePushMessages([target('a', { prefs: quiet })], notice, DEFAULT_NOTIFICATION_TRIGGERS, 9)).toHaveLength(1);
  });

  it('acil duyuru: tür başlıkta, duyurunun başlığı gövdede, sessiz saatte de ve yüksek öncelikle gider', () => {
    const quiet = { ...DEFAULT_NOTIFICATION_PREFS, quietHours: { enabled: true, start: 22, end: 8 } };
    const acil: PushNotice = { kind: 'announcement', category: 'acil', title: 'Nilüfer Belediyesi', body: 'Su kesintisi', href: { pathname: '/announcements/[id]', params: { id: 'd1' } } };
    const [m] = noticePushMessages([target('a', { prefs: quiet })], acil, DEFAULT_NOTIFICATION_TRIGGERS, 23);
    expect(m).toMatchObject({ title: 'Acil duyuru · Nilüfer Belediyesi', body: 'Su kesintisi', priority: 'high', interruptionLevel: 'time-sensitive' });
    const [d] = noticePushMessages([target('a', { language: 'de' })], { ...acil, category: 'duyuru' }, DEFAULT_NOTIFICATION_TRIGGERS, 12);
    expect(d.title).toBe('Mitteilung · Nilüfer Belediyesi');
    expect(d.priority).toBeUndefined();
  });

  it('mesajda başlık gönderenin adı, gövde mesajın kendisi; takipte kişinin adı metne yerleşir', () => {
    const href = { pathname: '/messages/[uid]', params: { uid: 'ali' } };
    const [m] = noticePushMessages([target('a')], { kind: 'message', category: 'mesaj', title: 'Ali Y.', body: 'Merhaba', href }, DEFAULT_NOTIFICATION_TRIGGERS, 12);
    expect(m).toMatchObject({ title: 'Ali Y.', body: 'Merhaba', data: { href } });
    const [r] = noticePushMessages([target('a', { language: 'en' })], { kind: 'messageRequest', category: 'mesaj', title: 'Ali Y.', href }, DEFAULT_NOTIFICATION_TRIGGERS, 12);
    expect(r).toMatchObject({ title: 'Message request', body: 'Ali Y. wants to send you a message.' });
    const [f] = noticePushMessages([target('a')], { kind: 'follower', category: 'takip', title: 'Ali Y.', href }, DEFAULT_NOTIFICATION_TRIGGERS, 12);
    expect(f).toMatchObject({ title: 'Yeni takipçi', body: 'Ali Y. seni takip etmeye başladı.' });
    const off = { ...DEFAULT_NOTIFICATION_PREFS, categories: { ...DEFAULT_NOTIFICATION_PREFS.categories, takip: false } };
    expect(noticePushMessages([target('a', { prefs: off })], { kind: 'follower', category: 'takip', title: 'Ali Y.', href }, DEFAULT_NOTIFICATION_TRIGGERS, 12)).toEqual([]);
  });

  it('her bildirim türünün metni beş dilde var', () => {
    const kinds = ['eventCancelled', 'activityCancelled', 'message', 'messageRequest', 'follower', 'followRequest', 'followAccepted'] as const;
    for (const language of ['tr', 'en', 'de', 'ar', 'ru'] as const) {
      for (const kind of kinds) {
        const [m] = noticePushMessages([target('a', { language })], { kind, category: 'mesaj', title: 'X', href: notice.href }, DEFAULT_NOTIFICATION_TRIGGERS, 12);
        expect(m.title, `${language} ${kind}`).toBeTruthy();
        expect(m.body, `${language} ${kind}`).toBeTruthy();
      }
    }
  });

  it('Türkiye saati UTC+3', () => {
    expect(turkeyHour(new Date('2026-10-31T22:30:00Z'))).toBe(1);
    expect(turkeyHour(new Date('2026-10-31T09:00:00Z'))).toBe(12);
  });
});
