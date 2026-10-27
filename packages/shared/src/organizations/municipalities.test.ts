import { describe, expect, it } from 'vitest';

import { isReservedName, listMunicipalities, normalizeName } from '../index';
import provinces from '../../data/locations/provinces.json';
import districts from '../../data/locations/districts.json';

describe('kilitli adlar', () => {
  it('belediye listesi: 30 büyükşehir, 51 il, merkez dışı tüm ilçeler', () => {
    const list = listMunicipalities(provinces, districts);
    expect(list.filter((m) => m.kind === 'buyuksehir-belediyesi')).toHaveLength(30);
    expect(list.filter((m) => m.kind === 'il-belediyesi')).toHaveLength(51);
    expect(list.filter((m) => m.kind === 'ilce-belediyesi')).toHaveLength(districts.length - 51);
    expect(new Set(list.map((m) => m.id)).size).toBe(list.length);
    expect(list.find((m) => m.id === 'bld-16')?.name).toBe('Bursa Büyükşehir Belediyesi');
    expect(list.find((m) => m.id === 'bld-16-nilufer')?.scope).toEqual({ level: 'ilce', provinceCode: '16', districtId: '16-nilufer' });
    expect(list.find((m) => m.id === 'bld-14')?.scope).toEqual({ level: 'ilce', provinceCode: '14', districtId: '14-merkez' });
  });

  it('resmî sözcükler büyük/küçük ve Türkçe harf farkı gözetmeden yakalanır', () => {
    expect(normalizeName('NİLÜFER Belediyesi')).toBe('nilufer belediyesi');
    for (const n of ['Nilüfer Belediyesi', 'NİLÜFER BELEDİYESİ', 'Bursa Valiliği', 'ataevler muhtarlığı', 'City Joy Resmi', 'cityjoy destek']) {
      expect(isReservedName(n)).toBe(true);
    }
    for (const n of ['Ahmet Usta Tesisat', 'Beledi Kafe', 'Vali Konağı Pansiyon']) expect(isReservedName(n)).toBe(false);
  });
});
