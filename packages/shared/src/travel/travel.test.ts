import { describe, expect, it } from 'vitest';

import { SEED_LOCAL, SEED_PLACES, SEED_ROUTES } from './seed';
import { byPopulation, regionOfProvince, routeHours, TR_REGIONS, validateTravelLocal, validateTravelMunicipal, validateTravelPlace, validateTravelRoute, validateTour } from './travel';

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

  it('rota ve yöresel başlangıç içeriği kurallara uyar; duraklar var olan yerlere bağlı', () => {
    const ids = new Set(SEED_PLACES.map((p) => p.id));
    for (const r of SEED_ROUTES) {
      expect(validateTravelRoute({ ...r.data, status: 'taslak' })).toEqual([]);
      for (const s of r.data.stops) if (s.placeId) expect(ids.has(s.placeId)).toBe(true);
    }
    for (const x of SEED_LOCAL) expect(validateTravelLocal({ ...x.data, status: 'taslak' })).toEqual([]);
    expect(validateTravelRoute({ ...SEED_ROUTES[0].data, stops: SEED_ROUTES[0].data.stops.slice(0, 1), status: 'taslak' })).toContain('lists');
    expect(validateTravelMunicipal({ slogan: 'Modern Bursa', description: 'Kısa', videoUrl: 'http://x.com' })).toEqual(['description', 'video']);
  });

  it('süre ve nüfus sıralaması', () => {
    expect(routeHours(270)).toEqual({ hours: 4.5 });
    expect(routeHours(45)).toEqual({ minutes: 45 });
    const list = [{ name: 'Keles' }, { name: 'Nilüfer', population: 500 }, { name: 'Osmangazi', population: 900 }, { name: 'Gemlik' }];
    expect([...list].sort(byPopulation).map((x) => x.name)).toEqual(['Osmangazi', 'Nilüfer', 'Gemlik', 'Keles']);
  });
});

describe('validateTour (İçini gez)', () => {
  const image = { path: 'media/u1/seyahat/a.jpg', url: 'https://x/a.jpg', width: 900, height: 1200 };
  const point = { x: 0.5, y: 0.4, title: 'Şadırvan', look: 'Ortadaki şadırvana bak.', why: '' };
  it('boş ya da geçerli sahneleri kabul eder', () => {
    expect(validateTour(undefined)).toBe(true);
    expect(validateTour([{ label: 'İç mekân', image, points: [point] }])).toBe(true);
  });
  it('sınır dışı nokta, boş ad ve yazısız noktayı reddeder', () => {
    expect(validateTour([{ label: 'İç', image, points: [{ ...point, x: 1.2 }] }])).toBe(false);
    expect(validateTour([{ label: ' ', image, points: [] }])).toBe(false);
    expect(validateTour([{ label: 'İç', image, points: [{ ...point, look: '', why: '' }] }])).toBe(false);
    expect(validateTour(Array.from({ length: 7 }, () => ({ label: 'A', image, points: [] })))).toBe(false);
  });
});
