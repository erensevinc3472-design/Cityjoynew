import { describe, expect, it } from 'vitest';

import { isEventVisible, publishersFor, remainingSeats, sortEvents, validateEvent, type EventInput, type PermissionGrant } from '../index';

const now = new Date('2026-10-28T12:00:00Z');
const nilufer = { level: 'ilce', provinceCode: '16', districtId: '16-nilufer' } as const;
const input = (patch: Partial<EventInput> = {}): EventInput => ({
  title: 'Nilüfer Caz Gecesi',
  description: 'Açık havada ücretsiz caz konseri.',
  category: 'muzik',
  startsAt: '2026-11-01T18:00:00Z',
  endsAt: '2026-11-01T21:00:00Z',
  venueName: 'Nilüfer Kültür Merkezi',
  region: { provinceCode: '16', districtId: '16-nilufer' },
  free: true,
  ...patch,
});

describe('etkinlikler', () => {
  it('alanlar denetlenir: tarih, yer, ücret, bilet bağlantısı, kontenjan, bölge', () => {
    expect(validateEvent(input(), nilufer, now)).toEqual([]);
    expect(validateEvent(input({ endsAt: '2026-11-01T17:00:00Z' }), nilufer, now)).toEqual(['dates']);
    expect(validateEvent(input({ startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-10-02T00:00:00Z' }), nilufer, now)).toEqual(['dates']);
    expect(validateEvent(input({ endsAt: '2027-03-01T00:00:00Z' }), nilufer, now)).toEqual(['dates']);
    expect(validateEvent(input({ venueName: '' }), nilufer, now)).toEqual(['venue']);
    expect(validateEvent(input({ free: false }), nilufer, now)).toEqual(['price']);
    expect(validateEvent(input({ free: false, priceNote: '50 TL', ticketUrl: 'https://biletix.com/x' }), nilufer, now)).toEqual([]);
    expect(validateEvent(input({ ticketUrl: 'http://ornek.com' }), nilufer, now)).toEqual(['ticketUrl']);
    expect(validateEvent(input({ capacity: 0 }), nilufer, now)).toEqual(['capacity']);
    expect(validateEvent(input({ capacity: 2.5 }), nilufer, now)).toEqual(['capacity']);
    expect(validateEvent(input({ region: { provinceCode: '16' } }), nilufer, now)).toEqual(['region']);
  });

  it('görünürlük, kalan yer ve sıralama', () => {
    expect(isEventVisible({ status: 'yayinda', endsAt: '2026-11-01T00:00:00Z' }, now)).toBe(true);
    expect(isEventVisible({ status: 'iptal', endsAt: '2026-11-01T00:00:00Z' }, now)).toBe(true);
    expect(isEventVisible({ status: 'yayinda', endsAt: '2026-10-01T00:00:00Z' }, now)).toBe(false);
    expect(isEventVisible({ status: 'onay-bekliyor', endsAt: '2026-11-01T00:00:00Z' }, now)).toBe(false);
    expect(remainingSeats({ capacity: 50, attendeeCount: 48 })).toBe(2);
    expect(remainingSeats({ capacity: 5, attendeeCount: 7 })).toBe(0);
    expect(remainingSeats({ attendeeCount: 7 })).toBeNull();
    const list = sortEvents([
      { id: 'b', startsAt: '2026-11-02', status: 'yayinda' as const },
      { id: 'c', startsAt: '2026-10-30', status: 'iptal' as const },
      { id: 'a', startsAt: '2026-11-01', status: 'yayinda' as const },
    ]);
    expect(list.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('etkinlik açabilenler: etkinlik bölümünde "Ekle" yetkisi olanlar', () => {
    const muhtar: PermissionGrant = {
      id: 'm', email: 'm@b.co', role: 'muhtar', grantedBy: 'x', grantedAt: '',
      scope: { level: 'mahalle', provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' },
      modules: { gonderiler: ['goruntule', 'ekle'], etkinlikler: ['goruntule'] },
    };
    expect(publishersFor([muhtar], [], now, 'gonderiler')).toHaveLength(1);
    expect(publishersFor([muhtar], [], now, 'etkinlikler')).toHaveLength(0);
    const withEvents = { ...muhtar, modules: { etkinlikler: ['goruntule' as const, 'ekle' as const] } };
    expect(publishersFor([withEvents], [], now, 'etkinlikler')).toHaveLength(1);
  });
});
