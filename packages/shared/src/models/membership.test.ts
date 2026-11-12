import { describe, expect, it } from 'vitest';

import { businessIdFromPurchaser, planOfProduct, proOffer, purchaserIdFor, summarizeRevenue, type Payment } from '../index';

const now = new Date(2026, 10, 12, 12);
const pay = (over: Partial<Payment>): Payment => ({
  id: 'e1', businessId: 'b1', businessName: 'Kafe', ownerUid: 'u1', provinceCode: '16', store: 'app-store',
  productId: 'cityjoy_pro_aylik', plan: 'aylik', kind: 'ilk', amount: 100, currency: 'TRY', amountUsd: 3, at: now.toISOString(), sandbox: false,
  ...over,
});

describe('Pro üyelik', () => {
  it('doğrulanmamış işletme Pro satın alamaz', () => {
    expect(proOffer({ verification: { status: 'beklemede' }, membership: { tier: 'ucretsiz' } }, now)).toBe('dogrulama-gerek');
    expect(proOffer({ verification: { status: 'dogrulandi' }, membership: { tier: 'ucretsiz' } }, now)).toBe('satin-alinabilir');
  });
  it('süresi geçmiş Pro yeniden satın alınabilir', () => {
    const b = { verification: { status: 'dogrulandi' }, membership: { tier: 'pro' as const, endsAt: new Date(2026, 9, 1).toISOString() } };
    expect(proOffer(b, now)).toBe('satin-alinabilir');
    expect(proOffer({ ...b, membership: { tier: 'pro', endsAt: new Date(2026, 11, 1).toISOString() } }, now)).toBe('pro');
  });
  it('mağaza ürünleri ve alıcı kimliği', () => {
    expect(planOfProduct('cityjoy_pro_yillik')).toBe('yillik');
    expect(planOfProduct('cityjoy_pro_aylik:aylik-plan')).toBe('aylik');
    expect(planOfProduct('baska_urun')).toBeUndefined();
    expect(businessIdFromPurchaser(purchaserIdFor('abc123'))).toBe('abc123');
    expect(businessIdFromPurchaser('$RCAnonymousID:x')).toBeUndefined();
  });
  it('gelir özeti: aylara böler, deneme ödemelerini saymaz', () => {
    const s = summarizeRevenue(
      [
        pay({}),
        pay({ id: 'e2', kind: 'yenileme', amount: 100 }),
        pay({ id: 'e3', kind: 'iade', amount: -100, amountUsd: -3 }),
        pay({ id: 'e4', currency: 'EUR', amount: 5, amountUsd: 5.5 }),
        pay({ id: 'e5', sandbox: true, amount: 999 }),
        pay({ id: 'e6', at: new Date(2026, 9, 5).toISOString(), amount: 80 }),
      ],
      now,
    );
    expect(s.thisMonth).toEqual({ TRY: 100, EUR: 5 });
    expect(s.lastMonth).toEqual({ TRY: 80 });
    expect(s.newThisMonth).toBe(2);
    expect(s.renewalsThisMonth).toBe(1);
    expect(s.refundsThisMonth).toBe(1);
    expect(s.months).toHaveLength(12);
    expect(s.months[11]).toMatchObject({ month: '2026-11', count: 4 });
    expect(s.thisMonthNetUsd).toBeCloseTo((3 + 3 - 3 + 5.5) * 0.85, 1);
  });
});
