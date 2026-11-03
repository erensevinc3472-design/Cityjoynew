import { describe, expect, it } from 'vitest';

import { locationBadgeFor } from './location-badge';

const provinces = [
  { code: '16', name: 'Bursa' },
  { code: '34', name: 'İstanbul' },
];
const me = { provinceCode: '16', districtName: 'Nilüfer', neighbourhoodName: 'Ataevler Mahallesi' };

describe('konum rozeti', () => {
  it('il, ilçe ve mahalle tutarsa mahalle; mahalle adı yoksa ya da farklıysa ilçe', () => {
    expect(locationBadgeFor({ region: 'Bursa', subregion: 'Nilüfer', district: 'Ataevler Mh.' }, me, provinces)).toBe('mahalle');
    expect(locationBadgeFor({ region: 'Bursa', subregion: 'NİLÜFER', district: 'ataevler' }, me, provinces)).toBe('mahalle');
    expect(locationBadgeFor({ region: 'Bursa', subregion: 'Nilüfer' }, me, provinces)).toBe('ilce');
    expect(locationBadgeFor({ region: 'Bursa', subregion: 'Nilüfer', district: 'Fethiye' }, me, provinces)).toBe('ilce');
  });

  it('başka ilçe ya da başka ilde rozet yok', () => {
    expect(locationBadgeFor({ region: 'Bursa', subregion: 'Osmangazi', district: 'Ataevler' }, me, provinces)).toBeNull();
    expect(locationBadgeFor({ region: 'İstanbul', subregion: 'Nilüfer' }, me, provinces)).toBeNull();
    expect(locationBadgeFor({}, me, provinces)).toBeNull();
  });
});
