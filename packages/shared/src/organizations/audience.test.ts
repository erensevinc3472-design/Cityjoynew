import { describe, expect, it } from 'vitest';

import { ageBandOf, audienceKeysOf, dayKey, EMPTY_STATS, foldSmall, homeSplit, periodChange, weeklyNet, within } from './audience';
import { mayorProfileTarget } from './profiles';
import type { Organization } from './types';

describe('kitle istatistiği', () => {
  it('yaş aralığı doğum yılından', () => {
    expect(ageBandOf(2010, 2026)).toBe('u18');
    expect(ageBandOf(2008, 2026)).toBe('18-24');
    expect(ageBandOf(2001, 2026)).toBe('25-34');
    expect(ageBandOf(1990, 2026)).toBe('35-44');
    expect(ageBandOf(1980, 2026)).toBe('45-54');
    expect(ageBandOf(1950, 2026)).toBe('55+');
  });

  it('takip anahtarları kayıtlı konumdan; konum yoksa boş', () => {
    const now = new Date('2026-11-03T10:00:00Z');
    expect(audienceKeysOf({ birthYear: 1990, location: { provinceCode: '16', districtId: '16-osmangazi', neighbourhoodId: '16-osmangazi-alipasa' } }, now)).toEqual({
      provinceCode: '16', districtId: '16-osmangazi', neighbourhoodId: '16-osmangazi-alipasa', ageBand: '35-44',
    });
    expect(audienceKeysOf({ birthYear: 1990 }, now)).toEqual({ provinceCode: null, districtId: null, neighbourhoodId: null, ageBand: '35-44' });
  });

  it('gün anahtarı UTC', () => {
    expect(dayKey(new Date('2026-01-05T23:30:00Z'))).toBe('20260105');
  });

  it('10 kişiden küçük gruplar "Diğer"e katılır; Diğer de küçükse gösterilmez', () => {
    expect(foldSmall({ a: 40, b: 12, c: 6, d: 5 })).toEqual({ rows: [{ key: 'a', value: 40 }, { key: 'b', value: 12 }], other: 11 });
    expect(foldSmall({ a: 40, c: 6 })).toEqual({ rows: [{ key: 'a', value: 40 }], other: null });
    expect(foldSmall({ a: 40, b: 30, c: 20 }, 2)).toEqual({ rows: [{ key: 'a', value: 40 }, { key: 'b', value: 30 }], other: 20 });
  });

  it('il içi / dışı, ilçe süzgeci, dönem ve hafta', () => {
    const now = new Date('2026-11-03T10:00:00Z');
    const s = {
      ...EMPTY_STATS, total: 100, unfollows: 4,
      p: { '16': 70, '34': 20 }, d: { '16-osmangazi': 50, '16-nilufer': 20, '34-kadikoy': 20 },
      f: { [dayKey(now)]: 5, '20261020': 3 }, u: { [dayKey(now)]: 1 },
    };
    expect(homeSplit(s, '16')).toEqual({ inside: 70, outside: 20, unknown: 10 });
    expect(within(s.d, '16-')).toEqual({ '16-osmangazi': 50, '16-nilufer': 20 });
    expect(periodChange(s, 7, now)).toEqual({ follows: 5, unfollows: 1, net: 4 });
    expect(periodChange(s, 30, now).follows).toBe(8);
    const weeks = weeklyNet(s, 3, now);
    expect(weeks.map((w) => w.follows)).toEqual([3, 0, 5]);
  });

  it('başkan profili yalnızca "Belediye başkanı" bölümü açık belediyede', () => {
    const org: Organization = {
      id: 'bld-16-osmangazi', name: 'Osmangazi Belediyesi', kind: 'ilce-belediyesi', scope: { level: 'ilce', provinceCode: '16', districtId: '16-osmangazi' },
      modules: ['gonderiler', 'baskan'], officialEmail: 'x@ornek.com', status: 'aktif', createdBy: 'eren', createdAt: '',
    };
    expect(mayorProfileTarget(org)).toEqual({ id: 'baskan-bld-16-osmangazi', type: 'baskan', name: 'Osmangazi Belediyesi', region: { provinceCode: '16', districtId: '16-osmangazi' }, orgId: org.id });
    expect(mayorProfileTarget({ ...org, modules: ['gonderiler'] })).toBeNull();
    expect(mayorProfileTarget({ ...org, id: 'krm-16-valilik', modules: ['baskan'] })).toBeNull();
  });
});
