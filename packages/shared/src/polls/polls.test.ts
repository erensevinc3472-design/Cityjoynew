import { describe, expect, it } from 'vitest';

import { pollDaysLeft, pollOpen, pollPercents, validatePoll, type PollInput } from './polls';

const now = new Date('2026-11-04T10:00:00');
const input = (over: Partial<PollInput> = {}): PollInput => ({
  question: 'Mahallene en çok hangisi gerekli?',
  options: [
    { id: 'a', label: 'Çocuk parkı' },
    { id: 'b', label: 'Otopark' },
  ],
  sponsorName: 'Osmangazi Belediyesi',
  provinceCode: '16',
  endsOn: '2026-11-10',
  ...over,
});

describe('Anketler', () => {
  it('soru, 2-6 farklı seçenek, hazırlayan ve en çok 60 gün', () => {
    expect(validatePoll(input(), now)).toEqual([]);
    expect(validatePoll(input({ options: [{ id: 'a', label: 'Park' }] }), now)).toEqual(['options']);
    expect(validatePoll(input({ options: [{ id: 'a', label: 'Park' }, { id: 'b', label: 'park' }] }), now)).toEqual(['options']);
    expect(validatePoll(input({ sponsorName: '' }), now)).toEqual(['sponsor']);
    expect(validatePoll(input({ endsOn: '2027-02-01' }), now)).toEqual(['endsOn']);
    expect(validatePoll(input({ endsOn: '2026-11-03' }), now)).toEqual(['endsOn']);
  });

  it('bitiş günü dahil açık; yüzdelerin toplamı 100', () => {
    expect(pollOpen({ status: 'yayinda', endsOn: '2026-11-04' }, now)).toBe(true);
    expect(pollOpen({ status: 'yayinda', endsOn: '2026-11-03' }, now)).toBe(false);
    expect(pollOpen({ status: 'kapali', endsOn: '2026-11-10' }, now)).toBe(false);
    expect(pollDaysLeft({ endsOn: '2026-11-08' }, now)).toBe(4);
    const p = pollPercents({ options: [{ id: 'a', label: '' }, { id: 'b', label: '' }, { id: 'c', label: '' }], counts: { a: 1, b: 1, c: 1 } });
    expect(p.a + p.b + p.c).toBe(100);
  });
});
