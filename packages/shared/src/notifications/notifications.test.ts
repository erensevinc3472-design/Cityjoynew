import { describe, expect, it } from 'vitest';

import {
  collectNotifications,
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
