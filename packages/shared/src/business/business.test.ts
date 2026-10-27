import { describe, expect, it } from 'vitest';

import {
  cleanBusinessInput,
  rankBusinesses,
  validateBusiness,
  weightedRating,
  whatsappUrl,
  type Business,
  type BusinessInput,
} from './business';

const input = (over: Partial<BusinessInput> = {}): BusinessInput => ({
  type: 'hizmet',
  name: 'Usta Ali Tesisat',
  categoryIds: ['tesisatci'],
  location: { provinceCode: '16', districtId: '16-nilufer' },
  phone: '05321234567',
  whatsapp: true,
  is24h: false,
  priceList: [],
  ...over,
});

let n = 0;
const biz = (over: Partial<Business> = {}): Business => ({
  ...input(),
  id: `b${++n}`,
  ownerUid: 'u',
  status: 'yayinda',
  verification: { status: 'dogrulanmadi' },
  membership: { tier: 'ucretsiz' },
  rating: { avg: 0, count: 0 },
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  ...over,
});

describe('işletme bilgileri', () => {
  it('doğrulama: ad, kategori, konum, telefon, ev işletmesinde adres yok', () => {
    expect(validateBusiness(input())).toEqual([]);
    expect(validateBusiness(input({ name: 'A', categoryIds: [], phone: '123' }))).toEqual(['name', 'categories', 'phone']);
    expect(validateBusiness(input({ location: { provinceCode: '16', districtId: '34-kadikoy' } }))).toEqual(['location']);
    expect(validateBusiness(input({ type: 'evden-uretim', address: 'Ev adresim' }))).toEqual(['address']);
    expect(validateBusiness(input({ priceList: [{ name: 'Musluk değişimi', price: '' }] }))).toEqual(['priceList']);
  });

  it('temizleme: boşluklar ve boş alanlar atılır, telefon rakama iner', () => {
    const c = cleanBusinessInput(input({ name: ' Ali ', phone: '0 (532) 123 45 67', description: '  ', priceList: [{ name: ' Keşif ', price: ' Ücretsiz ' }, { name: '', price: '' }] }));
    expect(c).toMatchObject({ name: 'Ali', phone: '05321234567', priceList: [{ name: 'Keşif', price: 'Ücretsiz' }] });
    expect('description' in c).toBe(false);
    expect(whatsappUrl('05321234567')).toBe('https://wa.me/905321234567');
  });
});

describe('sıralama (Karar, Eren)', () => {
  const now = new Date('2026-10-27T12:00:00Z');

  it('az yorumla yüksek puan, çok yorumlu iyi puanın önüne geçemez', () => {
    expect(weightedRating({ avg: 5, count: 1 })).toBeLessThan(weightedRating({ avg: 4.8, count: 200 }));
  });

  it('doğrulanmış önce, sonra puan, sonra kullanıcının ilçesi, sonra güncellik', () => {
    const a = biz({ rating: { avg: 4.9, count: 100 } });
    const b = biz({ verification: { status: 'dogrulandi' }, rating: { avg: 3, count: 10 } });
    const c = biz({ rating: { avg: 4.9, count: 100 }, location: { provinceCode: '16', districtId: '16-osmangazi' } });
    const d = biz({ rating: { avg: 4.9, count: 100 }, location: { provinceCode: '16', districtId: '16-osmangazi' }, updatedAt: '2026-10-20T00:00:00Z' });
    const hidden = biz({ status: 'gizli', verification: { status: 'dogrulandi' } });
    const { featured, others } = rankBusinesses([a, b, c, d, hidden], { districtId: '16-osmangazi', now });
    expect(featured).toEqual([]);
    expect(others.map((x) => x.id)).toEqual([b.id, d.id, c.id, a.id]);
  });

  it('üyelik kademesi sırayı değiştirmez; öne çıkanlar en çok 2 ve süresi dolan normal sıraya döner', () => {
    const free = biz({ rating: { avg: 4.5, count: 50 } });
    const premium = biz({ membership: { tier: 'premium' }, rating: { avg: 4, count: 0 } });
    expect(rankBusinesses([premium, free], { now }).others.map((x) => x.id)).toEqual([free.id, premium.id]);

    const f = (over: Partial<Business>) => biz({ featuredUntil: '2026-11-01T00:00:00Z', verification: { status: 'dogrulandi' }, ...over });
    const f1 = f({ rating: { avg: 5, count: 50 } });
    const f2 = f({ rating: { avg: 4.5, count: 50 } });
    const f3 = f({ rating: { avg: 3, count: 50 } });
    const expired = biz({ featuredUntil: '2026-10-01T00:00:00Z' });
    const r = rankBusinesses([f3, expired, f2, f1, free], { now });
    expect(r.featured.map((x) => x.id)).toEqual([f1.id, f2.id]);
    expect(r.others.map((x) => x.id)).toContain(f3.id);
    expect(r.others.map((x) => x.id)).toContain(expired.id);
    // Doğrulanmamış işletme öne çıkarılamaz.
    const unverified = biz({ featuredUntil: '2026-11-01T00:00:00Z', rating: { avg: 5, count: 500 } });
    expect(rankBusinesses([unverified], { now }).featured).toEqual([]);
  });
});
