import { describe, expect, it } from 'vitest';

import { cleanUsageReport, costDayKey, costFeatureOf, functionFeatureOf, isCostSampled, summarizeCost, type CostDay } from './cost';

describe('özelliklere göre harcama', () => {
  it('örneklem kimliğe göre sabit, yaklaşık yüzde 5', () => {
    const ids = Array.from({ length: 4000 }, (_, i) => `kullanici${i}`);
    const n = ids.filter((u) => isCostSampled(u)).length;
    expect(n).toBeGreaterThan(100);
    expect(n).toBeLessThan(300);
    expect(isCostSampled('ayse')).toBe(isCostSampled('ayse'));
  });

  it('rapor temizliği: geçersiz anahtar, negatif, kesirli ya da aşırı sayı reddedilir; sıfırlar düşer', () => {
    expect(cleanUsageReport({ reads: { posts: 12, follows: 0 }, writes: { posts: 1 } })).toEqual({ reads: { posts: 12 }, writes: { posts: 1 } });
    expect(cleanUsageReport({ reads: { 'a.b': 1 } })).toBeNull();
    expect(cleanUsageReport({ reads: { posts: -1 } })).toBeNull();
    expect(cleanUsageReport({ reads: { posts: 1.5 } })).toBeNull();
    expect(cleanUsageReport({ reads: { posts: 2_000_000 } })).toBeNull();
    expect(cleanUsageReport(null)).toBeNull();
  });

  it('koleksiyon ve sunucu işi özelliğe eşlenir', () => {
    expect(costFeatureOf('posts')).toBe('kesfet');
    expect(costFeatureOf('follows')).toBe('takip');
    expect(costFeatureOf('bilinmeyen')).toBe('diger');
    expect(functionFeatureOf('recordviews')).toBe('kesfet');
    expect(functionFeatureOf('businesspostcounted')).toBe('isletme');
    expect(functionFeatureOf('weatherrefresh')).toBe('sehir');
  });

  it('özet: örneklem büyütülür, en pahalı özellik başta, sunucu dışı veritabanı payı ayrılır', () => {
    const days: CostDay[] = [
      {
        day: '20261112',
        client: { reporters: 10, samplePct: 5, reads: { follows: 100_000, posts: 10_000 }, writes: { posts: 1_000 } },
        server: {
          functions: { recordviews: { calls: 1000, seconds: 500 } },
          firestore: { reads: 3_000_000, writes: 50_000, deletes: 0 },
          storage: { egressBytes: 1024 ** 3, storedBytes: 2 * 1024 ** 3 },
        },
      },
    ];
    const s = summarizeCost(days);
    expect(s.features[0].feature).toBe('takip');
    expect(s.features[0].reads).toBe(2_000_000);
    expect(s.features.find((f) => f.feature === 'kesfet')).toMatchObject({ reads: 200_000, writes: 20_000, calls: 1000 });
    expect(s.firestore.otherUsd).toBeGreaterThan(0);
    expect(s.storage.usd).toBeCloseTo(0.12 + 0.04 / 30, 3);
  });

  it('gün anahtarı Türkiye saatine göre', () => {
    expect(costDayKey(new Date('2026-11-12T22:30:00Z'))).toBe('20261113');
  });
});
