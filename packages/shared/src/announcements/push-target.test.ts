import { describe, expect, it } from 'vitest';

import { cleanPushTarget, matchesPushTarget, roundAudience, validatePushTarget } from './push-target';

describe('hedefli bildirim', () => {
  const now = new Date('2026-11-05T09:00:00Z');
  const ayse = { birthYear: 1955, gender: 'kadin' as const, occupationId: 'emekli', consents: { targeting: { granted: true } } };
  it('hedef boşsa herkes; doluysa yalnızca rıza veren ve her filtreye uyan', () => {
    expect(matchesPushTarget({ birthYear: 2000 }, null, now)).toBe(true);
    expect(matchesPushTarget(ayse, { ageMin: 65, genders: ['kadin'], occupations: ['emekli'] }, now)).toBe(true);
    expect(matchesPushTarget({ ...ayse, consents: {} }, { ageMin: 65 }, now)).toBe(false);
    expect(matchesPushTarget(ayse, { ageMax: 60 }, now)).toBe(false);
    expect(matchesPushTarget({ ...ayse, gender: undefined }, { genders: ['kadin'] }, now)).toBe(false);
    expect(matchesPushTarget(ayse, { occupations: ['ogretmen'] }, now)).toBe(false);
  });
  it('denetim, ayıklama ve yuvarlama', () => {
    expect(validatePushTarget({ ageMin: 70, ageMax: 60 })).toEqual(['age']);
    expect(validatePushTarget({ ageMin: 10 })).toEqual(['age']);
    expect(cleanPushTarget({ genders: [], occupations: [] })).toBeNull();
    expect(cleanPushTarget({ ageMin: 65, genders: ['kadin', 'kadin'] })).toEqual({ ageMin: 65, genders: ['kadin'] });
    expect(roundAudience(49)).toEqual({ tooSmall: true, approx: 0 });
    expect(roundAudience(1244)).toEqual({ tooSmall: false, approx: 1240 });
  });
});
