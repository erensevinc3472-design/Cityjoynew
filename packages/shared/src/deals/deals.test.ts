import { describe, expect, it } from 'vitest';

import { activeDealLimit, dealDaysLeft, dealLive, latestDealEnd, sortDeals, todayYmd, validateDeal, type Deal, type DealInput } from './deals';

const now = new Date('2026-11-03T10:00:00');
const input = (over: Partial<DealInput> = {}): DealInput => ({
  businessId: 'b1',
  category: 'food',
  kind: 'yuzde',
  value: '%20',
  title: 'Tüm kahvaltı menüsü',
  usage: 'kod',
  code: 'KAHVE20',
  endsOn: '2026-11-30',
  ...over,
});

describe('Fırsatlar', () => {
  it('bitiş zorunlu ve en çok 90 gün; kod kullanımında kod şart', () => {
    expect(validateDeal(input(), now)).toEqual([]);
    expect(latestDealEnd(now)).toBe('2027-02-01');
    expect(validateDeal(input({ endsOn: '2027-02-01' }), now)).toEqual([]);
    expect(validateDeal(input({ endsOn: '2027-02-02' }), now)).toEqual(['endsOn']);
    expect(validateDeal(input({ endsOn: '2026-11-02' }), now)).toEqual(['endsOn']);
    expect(validateDeal(input({ endsOn: '' }), now)).toEqual(['endsOn']);
    expect(validateDeal(input({ code: 'ab' }), now)).toEqual(['code']);
    expect(validateDeal(input({ usage: 'ekran', code: undefined }), now)).toEqual([]);
    expect(validateDeal(input({ value: '', title: 'ab' }), now)).toEqual(['value', 'title']);
  });

  it('süresi dolan listeden düşer; son gün geçerli', () => {
    const d = { status: 'aktif', endsOn: todayYmd(now) } as const;
    expect(dealLive(d, now)).toBe(true);
    expect(dealDaysLeft(d, now)).toBe(0);
    expect(dealLive({ ...d, endsOn: '2026-11-02' }, now)).toBe(false);
    expect(dealLive({ ...d, status: 'durduruldu' }, now)).toBe(false);
    expect(dealDaysLeft({ endsOn: '2026-11-10' }, now)).toBe(7);
  });

  it('kademe sınırı ve sıralama: sponsorlu önce, sonra bitişi yakın', () => {
    expect(activeDealLimit('ucretsiz')).toBe(1);
    expect(activeDealLimit('pro')).toBe(5);
    const mk = (id: string, endsOn: string, sponsored?: boolean) => ({ id, endsOn, sponsored, createdAt: '' }) as Deal;
    expect(sortDeals([mk('a', '2026-12-01'), mk('b', '2026-11-05'), mk('c', '2026-12-20', true)]).map((d) => d.id)).toEqual(['c', 'b', 'a']);
  });
});
