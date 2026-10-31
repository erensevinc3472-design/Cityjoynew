import { describe, expect, it } from 'vitest';

import { chatTitle, inboxSection, threadId } from '../messages/messages';
import { canRenewListing, isListingLive, parsePrice, pointInProvince, provinceCodeFromPlaceName, validateListing, type ListingInput } from './listings';

const input = (patch: Partial<ListingInput> = {}): ListingInput => ({
  kind: 'satilik',
  category: 'elektronik',
  condition: 'kullanilmis',
  title: 'Tablet',
  description: '',
  price: 2500,
  rentUnit: null,
  swapFor: '',
  region: { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' },
  ...patch,
});
const days = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

describe('Çarşı', () => {
  it('ilan denetimi: fiyat türe göre, kiralıkta süre birimi, emlak ilanı yok', () => {
    expect(validateListing(input())).toEqual([]);
    expect(validateListing(input({ price: null }))).toEqual(['price']);
    expect(validateListing(input({ kind: 'ucretsiz', price: null }))).toEqual([]);
    expect(validateListing(input({ kind: 'takas', price: 5 }))).toEqual(['price']);
    expect(validateListing(input({ kind: 'kiralik' }))).toEqual(['rentUnit']);
    expect(validateListing(input({ title: 'ab' }))).toEqual(['title']);
    expect(validateListing(input({ title: 'Satılık daire 3+1' }))).toEqual(['realEstate']);
  });

  it('fiyat yazımı', () => {
    expect(parsePrice('1.250')).toBe(1250);
    expect(parsePrice('1 250,50')).toBe(1250);
    expect(parsePrice('abc')).toBeNull();
  });

  it('30 gün yayında, şikâyetle düşer; 27. günden sonra yenilenir', () => {
    const l = { status: 'yayinda' as const, listedAt: days(1), reportCount: 0, cleared: false };
    expect(isListingLive(l)).toBe(true);
    expect(isListingLive({ ...l, listedAt: days(31) })).toBe(false);
    expect(isListingLive({ ...l, reportCount: 3 })).toBe(false);
    expect(isListingLive({ ...l, reportCount: 3, cleared: true })).toBe(true);
    expect(canRenewListing(l)).toBe(false);
    expect(canRenewListing({ ...l, listedAt: days(28) })).toBe(true);
  });

  it('telefonun konumu kayıtlı ilde mi (yaklaşık)', () => {
    expect(pointInProvince({ lat: 40.21, lng: 28.98 }, '16')).toBe(true);
    expect(pointInProvince({ lat: 41.0, lng: 29.0 }, '16')).toBe(false);
  });

  it('ilan sohbeti ayrı kimlikli; iki tarafta Çarşı, başlıkta kişinin adı', () => {
    const ctx = { type: 'ilan' as const, id: 'L1', title: 'Tablet' };
    expect(threadId('b', 'a', ctx)).toBe('a_b__l_L1');
    const chat = { members: ['a', 'b'] as [string, string], startedBy: 'a', accepted: true, context: ctx, names: { a: 'Ali', b: 'Bora' } };
    expect(inboxSection(chat, 'a')).toBe('carsi');
    expect(inboxSection(chat, 'b')).toBe('carsi');
    expect(chatTitle(chat, 'a')).toBe('Bora');
    expect(chatTitle(chat, 'b')).toBe('Ali');
  });
});

describe('adres çözümlemesinden il', () => {
  const provinces = [
    { code: '16', name: 'Bursa' },
    { code: '34', name: 'İstanbul' },
    { code: '03', name: 'Afyonkarahisar' },
  ];
  it('il adını tanır, tanımazsa null', () => {
    expect(provinceCodeFromPlaceName('Bursa', provinces)).toBe('16');
    expect(provinceCodeFromPlaceName('Istanbul', provinces)).toBe('34');
    expect(provinceCodeFromPlaceName('İSTANBUL İli', provinces)).toBe('34');
    expect(provinceCodeFromPlaceName('Afyon', provinces)).toBe('03');
    expect(provinceCodeFromPlaceName('Marmara Region', provinces)).toBeNull();
    expect(provinceCodeFromPlaceName(null, provinces)).toBeNull();
  });
});
