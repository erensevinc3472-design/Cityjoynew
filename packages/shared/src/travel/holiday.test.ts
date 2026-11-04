import { describe, expect, it } from 'vitest';

import { holidayPlaces, validateLodging, type LodgingInfo } from './holiday';

const lodging = (p: Partial<LodgingInfo> = {}): LodgingInfo => ({ themes: ['deniz'], licenseNo: 'TR-1234', ...p });
const stay = (provinceCode: string, l: Partial<LodgingInfo> = {}) => ({ location: { provinceCode }, lodging: lodging(l) });

describe('validateLodging', () => {
  it('geçerli bilgiyi kabul eder', () => {
    expect(validateLodging(lodging({ nightMin: 1800, nightMax: 3200, website: 'https://ornek.com' }))).toEqual([]);
  });
  it('eksik ve hatalı alanları bildirir', () => {
    expect(validateLodging(undefined)).toEqual(['license']);
    expect(validateLodging(lodging({ themes: [], licenseNo: 'ab', nightMin: 500, nightMax: 100, website: 'http://x' }))).toEqual(['themes', 'license', 'price', 'website']);
  });
});

describe('holidayPlaces', () => {
  it('ile göre toplar, fiyat aralığını çıkarır, gizleneni atar ve sıralar', () => {
    const list = [stay('07', { nightMin: 2000, nightMax: 5000 }), stay('07', { nightMin: 1500 }), stay('48'), stay('09', { nightMax: 900 })];
    const places = holidayPlaces(list, { '48': { rank: 1, season: 'Haziran-Eylül' }, '09': { hidden: true } });
    expect(places.map((p) => p.provinceCode)).toEqual(['48', '07']);
    expect(places[0]).toMatchObject({ count: 1, season: 'Haziran-Eylül' });
    expect(places[1]).toMatchObject({ count: 2, nightMin: 1500, nightMax: 5000 });
  });
});
