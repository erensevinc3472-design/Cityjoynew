import { describe, expect, it } from 'vitest';

import {
  clampSosConfig,
  distanceMeters,
  familyLinkId,
  formatInviteCode,
  generateInviteCode,
  isLive,
  isRecent,
  normalizeInviteCode,
  shouldSendLocation,
  sosPushMessages,
} from './sos';

describe('aile ve davet kodu', () => {
  it('bağ kimliği iki taraftan da aynı', () => {
    expect(familyLinkId('b', 'a')).toBe(familyLinkId('a', 'b'));
  });

  it('kod 8 karakter, karışan harf yok; yazım biçimi önemsiz', () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    expect(normalizeInviteCode(` ${formatInviteCode(code).toLowerCase()} `)).toBe(code);
    expect(normalizeInviteCode('ABCD-EFG')).toBeNull();
    expect(normalizeInviteCode('ABCD-EFG0')).toBeNull();
  });
});

describe('SOS', () => {
  const now = new Date('2026-10-27T12:00:00Z');

  it('canlı paylaşım: süre dolunca ya da "Güvendeyim" denince biter', () => {
    expect(isLive({ status: 'aktif', liveUntil: '2026-10-27T12:10:00Z' }, now)).toBe(true);
    expect(isLive({ status: 'guvende', liveUntil: '2026-10-27T12:10:00Z' }, now)).toBe(false);
    expect(isLive({ status: 'aktif', liveUntil: '2026-10-27T11:59:00Z' }, now)).toBe(false);
    expect(isRecent({ status: 'bitti', liveUntil: '2026-10-27T11:00:00Z', createdAt: '2026-10-27T10:30:00Z' }, now)).toBe(true);
    expect(isRecent({ status: 'bitti', liveUntil: '2026-10-27T09:00:00Z', createdAt: '2026-10-27T08:30:00Z' }, now)).toBe(false);
  });

  it('konum en sık 30 saniyede bir, hızlı yer değişiminde 10 saniyede bir gönderilir', () => {
    const prev = { lat: 40.19, lng: 29.06, at: '2026-10-27T11:59:45Z' };
    expect(shouldSendLocation(undefined, prev, now)).toBe(true);
    expect(shouldSendLocation(prev, { lat: 40.19, lng: 29.06 }, now)).toBe(false);
    expect(shouldSendLocation(prev, { lat: 40.191, lng: 29.06 }, now)).toBe(true);
    expect(Math.round(distanceMeters(prev, { lat: 40.191, lng: 29.06 }))).toBe(111);
  });

  it('panel ayarları sınırlar içinde kalır', () => {
    expect(clampSosConfig({ liveMinutes: 500, countdownSeconds: 1 })).toEqual({ liveMinutes: 120, countdownSeconds: 3 });
    expect(clampSosConfig({})).toEqual({ liveMinutes: 30, countdownSeconds: 5 });
  });
});

describe('SOS bildirimi', () => {
  it('her alıcıya kendi dilinde, yüksek öncelikli ve sesli; aynı telefona bir kez', () => {
    const msgs = sosPushMessages(
      [
        { uid: 'a', tokens: ['T1', 'T1', 'T2'], language: 'tr' },
        { uid: 'b', tokens: ['T3'], language: 'en' },
      ],
      { id: 's1', fromName: 'Ali', test: false },
      'yardim',
    );
    expect(msgs.map((m) => m.to)).toEqual(['T1', 'T2', 'T3']);
    expect(msgs[0]).toMatchObject({ title: 'Ali yardım istiyor', priority: 'high', sound: 'default', channelId: 'sos', data: { sosId: 's1' } });
    expect(msgs[2].title).toBe('Ali needs help');
    expect(sosPushMessages([{ uid: 'a', tokens: ['T1'], language: 'tr' }], { id: 's1', fromName: 'Ali', test: false }, 'guvende')[0].title).toBe('Ali güvende olduğunu bildirdi');
    expect(sosPushMessages([{ uid: 'a', tokens: ['T1'], language: 'tr' }], { id: 's1', fromName: 'Ali', test: true }, 'yardim')[0].title).toMatch(/^TEST/);
  });
});
