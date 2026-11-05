import { describe, expect, it } from 'vitest';

import { DEFAULT_IMPORTANT_DAYS, occurrencesBetween, startInYear, upcomingDays, validateImportantDay, type ImportantDay } from './important-days';

const byId = (id: string) => DEFAULT_IMPORTANT_DAYS.find((d) => d.id === id)!;

describe('önemli günler', () => {
  it('sabit, yıla göre değişen ve tek seferlik günler doğru tarihe düşer', () => {
    expect(startInYear(byId('29-ekim'), 2026)?.getDate()).toBe(29);
    // Anneler Günü: Mayıs'ın 2. pazarı (2026: 10 Mayıs, 2027: 9 Mayıs); Babalar Günü 3. pazar (2026: 21 Haziran).
    expect(startInYear(byId('anneler-gunu'), 2026)?.toDateString()).toBe(new Date(2026, 4, 10).toDateString());
    expect(startInYear(byId('anneler-gunu'), 2027)?.toDateString()).toBe(new Date(2027, 4, 9).toDateString());
    expect(startInYear(byId('babalar-gunu'), 2026)?.toDateString()).toBe(new Date(2026, 5, 21).toDateString());
    // Son pazar.
    expect(startInYear({ id: 'x', title: 'xxx', kind: 'yerel', nth: { month: 11, weekday: 0, n: -1 } }, 2026)?.getDate()).toBe(29);
    expect(startInYear(byId('kurban-2026'), 2027)).toBeNull();
  });

  it('çok günlü bayramın her günü takvimde, yaklaşanlarda yalnızca ilk günü', () => {
    const may = occurrencesBetween(DEFAULT_IMPORTANT_DAYS, new Date(2026, 4, 1), new Date(2026, 5, 1));
    expect(may.filter((o) => o.day.id === 'kurban-2026').map((o) => o.date)).toEqual(['2026-05-27', '2026-05-28', '2026-05-29', '2026-05-30']);
    expect(may.map((o) => o.day.id)).toEqual(expect.arrayContaining(['1-mayis', 'anneler-gunu', '19-mayis']));
    const up = upcomingDays(DEFAULT_IMPORTANT_DAYS, new Date(2026, 10, 5, 15), 21);
    expect(up.map((o) => [o.day.id, o.inDays])).toEqual([['10-kasim', 5], ['cocuk-haklari', 15], ['ogretmenler-gunu', 19], ['kadina-siddet', 20]]);
    // Yıl dönümünde: aralık sonundan ocak başına.
    expect(upcomingDays(DEFAULT_IMPORTANT_DAYS, new Date(2026, 11, 30), 12).map((o) => o.day.id)).toEqual(['yilbasi', 'calisan-gazeteciler']);
  });

  it('form denetimi', () => {
    const ok: ImportantDay = { id: 'a', title: 'Kurtuluş Günü', kind: 'yerel', md: '09-11' };
    expect(validateImportantDay(ok)).toEqual([]);
    expect(validateImportantDay({ ...ok, md: '02-30' })).toEqual(['date']);
    expect(validateImportantDay({ ...ok, md: undefined })).toEqual(['date']);
    expect(validateImportantDay({ ...ok, md: undefined, date: '2027-04-10', length: 3 })).toEqual([]);
    expect(validateImportantDay({ ...ok, title: 'ab', length: 20 })).toEqual(['title', 'length']);
    for (const d of DEFAULT_IMPORTANT_DAYS) expect(validateImportantDay(d), d.id).toEqual([]);
  });
});
