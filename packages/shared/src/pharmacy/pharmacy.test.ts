import { describe, expect, it } from 'vitest';

import { isPharmacyListCurrent, normalizePharmacy, pharmaciesFor, pharmacyKey, turkeyDate } from './pharmacy';

describe('nöbetçi eczane', () => {
  it('Türkiye tarihi ve listenin güncelliği (sabah 09.00a kadar dünkü liste de geçerli)', () => {
    expect(turkeyDate(new Date('2026-11-05T22:30:00Z'))).toBe('2026-11-06');
    expect(isPharmacyListCurrent({ date: '2026-11-06' }, new Date('2026-11-06T09:00:00Z'))).toBe(true);
    expect(isPharmacyListCurrent({ date: '2026-11-05' }, new Date('2026-11-06T04:00:00Z'))).toBe(true); // 07.00
    expect(isPharmacyListCurrent({ date: '2026-11-05' }, new Date('2026-11-06T08:00:00Z'))).toBe(false); // 11.00
  });

  it('kişinin ilçesi önce, gizlenen çıkar', () => {
    const items = [
      { name: 'B Eczanesi', district: 'Nilüfer', address: 'x' },
      { name: 'A Eczanesi', district: 'Osmangazi', address: 'y' },
      { name: 'C Eczanesi', district: 'Osmangazi', address: 'z' },
    ];
    const day = { date: '2026-11-06', fetchedAt: '', source: 's', items, hidden: [pharmacyKey(items[2]!)] };
    expect(pharmaciesFor(day, 'osmangazi').map((p) => p.name)).toEqual(['A Eczanesi', 'B Eczanesi']);
  });

  it('servis kaydını ortak biçime çevirir; eksik kaydı atar', () => {
    expect(normalizePharmacy({ pharmacyName: 'Şifa Eczanesi', address: 'Atatürk Cd. 1', phone: '02240000000', district: 'Osmangazi', latitude: '40.18', longitude: 29.06 }))
      .toEqual({ name: 'Şifa Eczanesi', district: 'Osmangazi', address: 'Atatürk Cd. 1', phone: '02240000000', lat: 40.18, lng: 29.06 });
    expect(normalizePharmacy({ EczaneAdi: 'Deva', Adres: 'Cami Sk.', Ilce: 'Yıldırım' })).toEqual({ name: 'Deva', district: 'Yıldırım', address: 'Cami Sk.' });
    expect(normalizePharmacy({ name: 'Adressiz' })).toBeNull();
  });
});
