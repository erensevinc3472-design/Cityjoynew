import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { contentInsights, contentViewId, hourBand, sha256Hex, weekdayTr, type ContentPerformance } from './content-stats';

describe('içerik istatistiği', () => {
  it('SHA-256 Node ile aynı sonucu verir (Türkçe karakter ve uzun metin dahil)', () => {
    for (const s of ['', 'abc', 'uid123d1', 'Çalışma şığ ÖĞÜ', 'x'.repeat(1000)]) {
      expect(sha256Hex(s)).toBe(createHash('sha256').update(s).digest('hex').toUpperCase());
    }
    expect(contentViewId('d1', 'ayse')).toBe(`d1_${createHash('sha256').update('ayse' + 'd1').digest('hex').toUpperCase()}`);
  });

  it('Türkiye saatine göre gün ve saat dilimi', () => {
    expect(hourBand('2026-11-02T06:30:00Z')).toBe('sabah'); // 09.30
    expect(hourBand('2026-11-02T17:00:00Z')).toBe('aksam'); // 20.00
    expect(hourBand('2026-11-02T22:00:00Z')).toBe('gece'); // 01.00
    expect(weekdayTr('2026-11-01T22:30:00Z')).toBe(1); // Pazartesi 01.30
  });

  it('bulgular yeterli veri varsa çıkar', () => {
    const row = (id: string, kind: ContentPerformance['kind'], publishedAt: string, reads: number, shares = 0): ContentPerformance => ({
      id, kind, title: id, publishedAt, reads, shares,
    });
    // Akşam yayınlanan haberler belirgin daha çok okunuyor.
    const rows = [
      row('h1', 'haber', '2026-11-02T17:00:00Z', 300, 12),
      row('h2', 'haber', '2026-11-03T17:30:00Z', 280, 10),
      row('h3', 'haber', '2026-11-04T18:00:00Z', 320, 9),
      row('d1', 'duyuru', '2026-11-02T07:00:00Z', 60, 1),
      row('d2', 'duyuru', '2026-11-03T07:00:00Z', 50),
      row('d3', 'duyuru', '2026-11-04T07:00:00Z', 40),
    ];
    const ins = contentInsights(rows, 1000);
    expect(ins.find((i) => i.type === 'enIyi')).toMatchObject({ id: 'h3', reads: 320 });
    expect(ins.find((i) => i.type === 'tur')).toMatchObject({ kind: 'haber' });
    expect(ins.find((i) => i.type === 'saat')).toMatchObject({ band: 'aksam' });
    expect(ins.find((i) => i.type === 'erisim')).toMatchObject({ pct: 18 });
    expect(ins.find((i) => i.type === 'paylasim')).toMatchObject({ pct: 3 });
    expect(ins.find((i) => i.type === 'dusuk')).toMatchObject({ count: 3 });
    // Az içerikte yalnızca en çok okunan çıkar; hiç içerik yoksa bulgu yok.
    expect(contentInsights(rows.slice(0, 2), null).map((i) => i.type)).toEqual(['enIyi', 'paylasim']);
    expect(contentInsights([], 100)).toEqual([]);
  });
});
