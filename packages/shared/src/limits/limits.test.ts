import { describe, expect, it } from 'vitest';

import { DEFAULT_LIMITS, isNewAccount, limitFor, nextUsage, normalizeLimits, publishUsage } from './limits';

const now = new Date('2026-10-31T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();

describe('günlük sınırlar', () => {
  it('sayaç dolunca izin yok; pencere geçince 1’den başlar ve yenilenme anını verir', () => {
    expect(nextUsage(null, 'gonderi', 10, now)).toMatchObject({ reset: true, count: 1, allowed: true });
    expect(nextUsage({ windowStart: hoursAgo(2), count: 10 }, 'gonderi', 10, now)).toMatchObject({ allowed: false, resetAt: new Date(now.getTime() + 22 * 3600_000).toISOString() });
    expect(nextUsage({ windowStart: hoursAgo(25), count: 10 }, 'gonderi', 10, now)).toMatchObject({ reset: true, count: 1, allowed: true });
    // Haftalık duyuru sayacı 7 gün sürer.
    expect(nextUsage({ windowStart: hoursAgo(48), count: 20 }, 'duyuru-hafta', 20, now).allowed).toBe(false);
  });

  it('yeni hesapta düşük sınır; duyuruda kurum ve muhtar ayrı', () => {
    const l = normalizeLimits({ gonderi: 12, kurumDuyuru: 0, muhtarDuyuru: 'x' });
    expect(l.gonderi).toBe(12);
    expect(l.kurumDuyuru).toBe(DEFAULT_LIMITS.kurumDuyuru);
    expect(limitFor('gonderi', { type: 'u', id: 'a' }, l, isNewAccount(hoursAgo(24), now))).toBe(3);
    expect(limitFor('gonderi', { type: 'u', id: 'a' }, l, isNewAccount(hoursAgo(24 * 8), now))).toBe(12);
    expect(limitFor('duyuru', { type: 'k', id: 'o' }, l, false)).toBe(5);
    expect(limitFor('duyuru', { type: 'g', id: 'g' }, l, false)).toBe(3);
  });

  it('il yöneticisi sınırsız; acil kendi sayacıyla', () => {
    expect(publishUsage({ type: 'kisi', role: 'il-yoneticisi', grantKey: 'g' }, { module: 'duyuru', kind: 'genel' })).toBeNull();
    expect(publishUsage({ type: 'kisi', role: 'muhtar', grantKey: 'g1' }, { module: 'duyuru', kind: 'acil' })).toEqual({ subject: { type: 'g', id: 'g1' }, kinds: ['acil'] });
    expect(publishUsage({ type: 'kurum', orgId: 'o1' }, { module: 'duyuru', kind: 'genel' })?.kinds).toEqual(['duyuru', 'duyuru-hafta']);
  });
});
