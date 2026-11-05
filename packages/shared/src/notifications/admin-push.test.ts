import { describe, expect, it } from 'vitest';

import { adminPushHref, adminPushReaches, regionCovers, validateAdminPush } from './admin-push';

const now = new Date('2026-11-05T09:00:00Z');
const loc = { provinceCode: '16', districtId: '16-osmangazi', neighbourhoodId: '16-osmangazi-alipasa' };
const adult = { birthYear: 1990, gender: 'kadin' as const, occupationId: 'ogretmen', location: loc };

describe('admin bildirimi', () => {
  it('bölge: ülke geneli herkes; il / ilçe / mahalle eşleşmeli', () => {
    expect(regionCovers({}, null)).toBe(true);
    expect(regionCovers({ provinceCode: '16' }, loc)).toBe(true);
    expect(regionCovers({ provinceCode: '16', districtId: '16-nilufer' }, loc)).toBe(false);
    expect(regionCovers({ provinceCode: '34' }, undefined)).toBe(false);
  });

  it('duyuru herkese; kampanya ve reklam yalnızca kampanya izni veren 18+ kişiye', () => {
    expect(adminPushReaches(adult, { kind: 'duyuru', region: { provinceCode: '16' } }, now)).toBe(true);
    expect(adminPushReaches(adult, { kind: 'reklam', region: {} }, now)).toBe(false);
    const ok = { ...adult, consents: { commercialMessages: { granted: true } } };
    expect(adminPushReaches(ok, { kind: 'reklam', region: {} }, now)).toBe(true);
    expect(adminPushReaches({ ...ok, birthYear: 2010 }, { kind: 'kampanya', region: {} }, now)).toBe(false);
    expect(adminPushReaches(ok, { kind: 'kampanya', region: {}, target: { genders: ['erkek'] } }, now)).toBe(false);
  });

  it('denetim ve açılacak ekran', () => {
    const base = { kind: 'duyuru', title: 'Kar uyarısı', body: 'Yarın kar bekleniyor.', link: { type: 'yok' }, sendAt: now.toISOString() } as const;
    expect(validateAdminPush(base, now)).toEqual([]);
    expect(validateAdminPush({ ...base, kind: 'reklam' }, now)).toEqual(['business']);
    expect(validateAdminPush({ ...base, link: { type: 'isletme', id: '' } }, now)).toEqual(['link']);
    expect(validateAdminPush({ ...base, sendAt: new Date(now.getTime() + 90 * 86400000).toISOString() }, now)).toEqual(['sendAt']);
    expect(adminPushHref({ type: 'isletme', id: 'b1' })).toEqual({ pathname: '/business/[id]', params: { id: 'b1' } });
  });
});
