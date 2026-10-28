import { describe, expect, it } from 'vitest';

import {
  cleanBusinessInput,
  openState,
  postModeFor,
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
  rating: { sum: 0, count: 0 },
  followerCount: 0,
  managers: [],
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
    expect(weightedRating({ sum: 5, count: 1 })).toBeLessThan(weightedRating({ sum: 960, count: 200 }));
  });

  it('doğrulanmış önce, sonra puan, sonra kullanıcının ilçesi, sonra güncellik', () => {
    const a = biz({ rating: { sum: 490, count: 100 } });
    const b = biz({ verification: { status: 'dogrulandi' }, rating: { sum: 30, count: 10 } });
    const c = biz({ rating: { sum: 490, count: 100 }, location: { provinceCode: '16', districtId: '16-osmangazi' } });
    const d = biz({ rating: { sum: 490, count: 100 }, location: { provinceCode: '16', districtId: '16-osmangazi' }, updatedAt: '2026-10-20T00:00:00Z' });
    const hidden = biz({ status: 'gizli', verification: { status: 'dogrulandi' } });
    const { featured, others } = rankBusinesses([a, b, c, d, hidden], { districtId: '16-osmangazi', now });
    expect(featured).toEqual([]);
    expect(others.map((x) => x.id)).toEqual([b.id, d.id, c.id, a.id]);
  });

  it('üyelik kademesi sırayı değiştirmez; öne çıkanlar en çok 2 ve süresi dolan normal sıraya döner', () => {
    const free = biz({ rating: { sum: 225, count: 50 } });
    const premium = biz({ membership: { tier: 'premium' }, rating: { sum: 0, count: 0 } });
    expect(rankBusinesses([premium, free], { now }).others.map((x) => x.id)).toEqual([free.id, premium.id]);

    const f = (over: Partial<Business>) => biz({ featuredUntil: '2026-11-01T00:00:00Z', verification: { status: 'dogrulandi' }, ...over });
    const f1 = f({ rating: { sum: 250, count: 50 } });
    const f2 = f({ rating: { sum: 225, count: 50 } });
    const f3 = f({ rating: { sum: 150, count: 50 } });
    const expired = biz({ featuredUntil: '2026-10-01T00:00:00Z' });
    const r = rankBusinesses([f3, expired, f2, f1, free], { now });
    expect(r.featured.map((x) => x.id)).toEqual([f1.id, f2.id]);
    expect(r.others.map((x) => x.id)).toContain(f3.id);
    expect(r.others.map((x) => x.id)).toContain(expired.id);
    // Doğrulanmamış işletme öne çıkarılamaz.
    const unverified = biz({ featuredUntil: '2026-11-01T00:00:00Z', rating: { sum: 2500, count: 500 } });
    expect(rankBusinesses([unverified], { now }).featured).toEqual([]);
  });

  it('şu an açık mı: 7/24, haftalık saat, gece yarısını geçen saat, saat yoksa bilinmiyor', () => {
    const day = (open: string, close: string) => ({ open, close });
    // Pazartesi 09-18, salı kapalı, cumartesi 18-02, diğer günler 10-22.
    const week = [day('09:00', '18:00'), null, day('10:00', '22:00'), day('10:00', '22:00'), day('10:00', '22:00'), day('18:00', '02:00'), day('10:00', '22:00')];
    const at = (iso: string) => new Date(iso);
    expect(openState({ is24h: true }, at('2026-10-26T03:00:00'))).toEqual({ open: true });
    expect(openState({ is24h: false }, at('2026-10-26T12:00:00'))).toBeNull();
    // 26 Ekim 2026 pazartesi.
    expect(openState({ is24h: false, weeklyHours: week }, at('2026-10-26T12:00:00'))).toEqual({ open: true, until: '18:00' });
    expect(openState({ is24h: false, weeklyHours: week }, at('2026-10-26T08:00:00'))).toEqual({ open: false, until: '09:00' });
    expect(openState({ is24h: false, weeklyHours: week }, at('2026-10-27T12:00:00'))).toEqual({ open: false });
    // Cumartesi 23:30 açık, pazar 01:00 hâlâ cumartesinin açıklığı.
    expect(openState({ is24h: false, weeklyHours: week }, at('2026-10-31T23:30:00'))).toEqual({ open: true, until: '02:00' });
    expect(openState({ is24h: false, weeklyHours: week }, at('2026-11-01T01:00:00'))).toEqual({ open: true, until: '02:00' });
    expect(validateBusiness(input({ weeklyHours: [day('9:00', '18:00'), null, null, null, null, null, null] }))).toContain('hours');
  });

  it('yetkili paylaşımı: sahibi doğrudan, yetkili izne göre, izni kapalı ya da yetkisiz paylaşamaz', () => {
    const b = biz({ ownerUid: 'sahip', managers: [
      { uid: 'ayse', name: 'Ayşe K.', post: 'onayla', edit: false, reply: false },
      { uid: 'veli', name: 'Veli T.', post: 'kapali', edit: true, reply: true },
    ] });
    expect(postModeFor(b, 'sahip')).toBe('dogrudan');
    expect(postModeFor(b, 'ayse')).toBe('onayla');
    expect(postModeFor(b, 'veli')).toBeNull();
    expect(postModeFor(b, 'yabanci')).toBeNull();
  });
});
