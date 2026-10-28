import { describe, expect, it } from 'vitest';

import { SEED_PLACES } from './seed';
import { regionOfProvince, TR_REGIONS, validateTravelPlace } from './travel';

describe('seyahat', () => {
  it('7 bölge 81 ilin her birini bir kez kapsar', () => {
    const all = TR_REGIONS.flatMap((r) => r.provinceCodes);
    expect(TR_REGIONS).toHaveLength(7);
    expect(all).toHaveLength(81);
    expect(new Set(all).size).toBe(81);
    const codes = Array.from({ length: 81 }, (_, i) => String(i + 1).padStart(2, '0'));
    expect([...all].sort()).toEqual(codes);
    expect(regionOfProvince('16')?.id).toBe('marmara');
    expect(regionOfProvince('63')?.id).toBe('guneydogu');
  });

  it('başlangıç içeriği kurallara uyar; http bağlantı ve boş yazı reddedilir', () => {
    for (const p of SEED_PLACES) expect(validateTravelPlace({ ...p.data, status: 'taslak' })).toEqual([]);
    const base = { ...SEED_PLACES[0].data, status: 'taslak' as const };
    expect(validateTravelPlace({ ...base, website: 'http://ornek.com' })).toContain('website');
    expect(validateTravelPlace({ ...base, about: '' })).toContain('about');
    expect(validateTravelPlace({ ...base, tips: [''] })).toContain('lists');
  });
});
