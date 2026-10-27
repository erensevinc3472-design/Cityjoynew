import { describe, expect, it } from 'vitest';

import { authorNameOf, isValidReviewText, isValidStars, nextRating } from './reviews';

describe('değerlendirmeler', () => {
  it('yazar adı yalnızca ad ve soyadın baş harfi', () => {
    expect(authorNameOf('Ayşe Nur Kaya')).toBe('Ayşe K.');
    expect(authorNameOf('ali şahin')).toBe('ali Ş.');
    expect(authorNameOf('Eren')).toBe('Eren');
    expect(authorNameOf('  ')).toBe('CityJoy');
  });

  it('yıldız 1-5 tam sayı, metin 10-500 karakter', () => {
    expect([0, 1, 5, 6, 3.5].map(isValidStars)).toEqual([false, true, true, false, false]);
    expect(isValidReviewText('Kısa')).toBe(false);
    expect(isValidReviewText('Zamanında geldi, temiz çalıştı.')).toBe(true);
  });

  it('puan toplamı: ekleme, değiştirme, silme, gizlenmiş yorum sayılmaz', () => {
    const r = { sum: 8, count: 2 };
    expect(nextRating(r, null, { stars: 5, live: true })).toEqual({ sum: 13, count: 3 });
    expect(nextRating(r, { stars: 3, live: true }, { stars: 5, live: true })).toEqual({ sum: 10, count: 2 });
    expect(nextRating(r, { stars: 3, live: true }, null)).toEqual({ sum: 5, count: 1 });
    expect(nextRating(r, { stars: 3, live: true }, { stars: 3, live: false })).toEqual({ sum: 5, count: 1 });
  });
});
