import { describe, expect, it } from 'vitest';

import { canJoinActivity, canUseActivities, isActivityListed, sortActivities, validateActivity, type ActivityInput } from '../index';

const now = new Date('2026-10-28T12:00:00Z');
const input = (patch: Partial<ActivityInput> = {}): ActivityInput => ({
  title: 'Pazar sabahı yürüyüş',
  description: 'Parkta bir saatlik tempolu yürüyüş.',
  category: 'yuruyus-doga',
  startsAt: '2026-11-01T07:00:00Z',
  endsAt: '2026-11-01T08:00:00Z',
  region: { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' },
  address: 'Ataevler Parkı girişi',
  capacity: 8,
  ...patch,
});

describe('aktiviteler', () => {
  it('alanlar denetlenir: tarih (gelecek, en çok 30 gün, en çok 12 saat), yer, kontenjan, mahalle', () => {
    expect(validateActivity(input(), now)).toEqual([]);
    expect(validateActivity(input({ startsAt: '2026-10-28T11:00:00Z', endsAt: '2026-10-28T13:00:00Z' }), now)).toEqual(['dates']);
    expect(validateActivity(input({ startsAt: '2026-12-15T07:00:00Z', endsAt: '2026-12-15T08:00:00Z' }), now)).toEqual(['dates']);
    expect(validateActivity(input({ endsAt: '2026-11-01T20:00:00Z' }), now)).toEqual(['dates']);
    expect(validateActivity(input({ address: 'ev' }), now)).toEqual(['address']);
    expect(validateActivity(input({ capacity: 0 }), now)).toEqual(['capacity']);
    expect(validateActivity(input({ capacity: 51 }), now)).toEqual(['capacity']);
    expect(validateActivity(input({ region: { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '34-kadikoy-moda' } }), now)).toEqual(['region']);
    expect(validateActivity(input({ startsAt: '', endsAt: '' }), now)).toEqual(['dates']);
  });

  it('yalnızca 18 yaş ve üstü', () => {
    expect(canUseActivities(2000, now)).toBe(true);
    expect(canUseActivities(2008, now)).toBe(true);
    expect(canUseActivities(2010, now)).toBe(false);
    expect(canUseActivities(undefined, now)).toBe(false);
  });

  it('liste: başlamış, kaldırılmış ve 3 şikâyetli (moderatör bırakmadıkça) görünmez; katılım kontenjanla', () => {
    const base = { status: 'aktif' as const, startsAt: '2026-11-01T07:00:00Z', reportCount: 0, cleared: false };
    expect(isActivityListed(base, now)).toBe(true);
    expect(isActivityListed({ ...base, status: 'iptal' }, now)).toBe(true);
    expect(isActivityListed({ ...base, status: 'kaldirildi' }, now)).toBe(false);
    expect(isActivityListed({ ...base, startsAt: '2026-10-28T11:00:00Z' }, now)).toBe(false);
    expect(isActivityListed({ ...base, reportCount: 3 }, now)).toBe(false);
    expect(isActivityListed({ ...base, reportCount: 3, cleared: true }, now)).toBe(true);
    expect(canJoinActivity({ status: 'aktif', startsAt: '2026-11-01T07:00:00Z', capacity: 2, attendeeCount: 1 }, now)).toBe(true);
    expect(canJoinActivity({ status: 'aktif', startsAt: '2026-11-01T07:00:00Z', capacity: 2, attendeeCount: 2 }, now)).toBe(false);
    expect(canJoinActivity({ status: 'iptal', startsAt: '2026-11-01T07:00:00Z', capacity: 2, attendeeCount: 0 }, now)).toBe(false);
    const sorted = sortActivities([
      { id: 'b', startsAt: '2026-11-02', status: 'aktif' as const },
      { id: 'c', startsAt: '2026-10-30', status: 'iptal' as const },
      { id: 'a', startsAt: '2026-11-01', status: 'aktif' as const },
    ]);
    expect(sorted.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
});
