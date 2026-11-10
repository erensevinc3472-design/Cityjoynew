import { describe, expect, it } from 'vitest';

import { pickSponsor, sponsorLive, validateSponsor, type Sponsor, type SponsorInput } from './sponsors';

const base: SponsorInput = { name: 'Osmangazi Belediyesi', line: 'Bu sayfa Osmangazi Belediyesi katkılarıyla', provinceCode: '16', places: ['sosyal'], startsOn: '2026-11-01', endsOn: '2026-11-30', active: true };
const s = (id: string, x: Partial<SponsorInput> = {}): Sponsor => ({ ...base, ...x, id, updatedAt: '' });
const now = new Date('2026-11-11T12:00:00');

describe('sponsor', () => {
  it('doğrular', () => {
    expect(validateSponsor(base)).toEqual([]);
    expect(validateSponsor({ ...base, name: 'x', url: 'http://a.com', places: [], endsOn: '2026-10-01' })).toEqual(['name', 'url', 'places', 'dates']);
  });
  it('tarih ve açıklık', () => {
    expect(sponsorLive(base, now)).toBe(true);
    expect(sponsorLive({ ...base, active: false }, now)).toBe(false);
    expect(sponsorLive({ ...base, endsOn: '2026-11-10' }, now)).toBe(false);
    expect(sponsorLive({ ...base, startsOn: '2026-11-11', endsOn: '2026-11-11' }, now)).toBe(true);
  });
  it('önce ilin sponsoru, yoksa Türkiye geneli', () => {
    const tr = s('b', { provinceCode: 'TR', places: ['sosyal', 'firsatlar'] });
    expect(pickSponsor([tr, s('a')], '16', 'sosyal', now)?.id).toBe('a');
    expect(pickSponsor([tr, s('a')], '35', 'sosyal', now)?.id).toBe('b');
    expect(pickSponsor([tr, s('a')], '16', 'firsatlar', now)?.id).toBe('b');
    expect(pickSponsor([s('a', { active: false })], '16', 'sosyal', now)).toBeUndefined();
  });
  it('birden çok sponsor günlere göre döner', () => {
    const list = [s('a'), s('b')];
    const d1 = pickSponsor(list, '16', 'sosyal', now)?.id;
    const d2 = pickSponsor(list, '16', 'sosyal', new Date('2026-11-12T12:00:00'))?.id;
    expect(d1).not.toBe(d2);
  });
});
