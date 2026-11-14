import { describe, expect, it } from 'vitest';

import { alternativesFor, buildPlan, fitsAt, hhmm, moveBetween, moveToNextDay, openNow, removeStop, replaceStop, weekdayOf, type PlanItem } from './itinerary';
import { parseGeo, validHours, validateTravelPlace, type TravelPlace } from './travel';

const base = (id: string, over: Partial<TravelPlace>): TravelPlace => ({
  id,
  cityId: '16',
  name: id,
  kind: 'Tarihî yapı',
  category: 'tarih',
  summary: 'Kısa bir açıklama yazısı.',
  about: 'Uzun bir açıklama yazısı.',
  howToGet: [],
  nearby: [],
  tips: [],
  mustSee: false,
  order: 1,
  status: 'yayinda',
  updatedAt: '',
  ...over,
});

const mosque = { allDay: true, closedDays: [], prayer: true };
// Bursa merkezindeki yerler (yaklaşık konumlar) ve uzakta bir dağ.
const PLACES: TravelPlace[] = [
  base('ulu', { mustSee: true, order: 1, location: { lat: 40.1838, lng: 29.0617 }, hours: mosque, durationMinutes: 45 }),
  base('koza', { category: 'alisveris', order: 2, location: { lat: 40.1834, lng: 29.0636 }, hours: { allDay: false, open: '09:00', close: '19:00', closedDays: [0], prayer: false }, durationMinutes: 60 }),
  base('yesil', { mustSee: true, order: 3, location: { lat: 40.1817, lng: 29.0748 }, hours: { allDay: false, open: '08:30', close: '18:00', closedDays: [], prayer: true }, durationMinutes: 60 }),
  base('emir', { order: 4, location: { lat: 40.1868, lng: 29.0869 }, hours: mosque, durationMinutes: 40 }),
  base('muradiye', { order: 5, location: { lat: 40.1916, lng: 29.0459 }, hours: { allDay: false, open: '09:00', close: '17:30', closedDays: [1], prayer: false } }),
  base('tophane', { order: 6, location: { lat: 40.1878, lng: 29.0563 }, hours: { allDay: true, closedDays: [], prayer: false } }),
  base('uludag', { category: 'doga', order: 7, location: { lat: 40.1, lng: 29.12 }, durationMinutes: 180 }),
  base('golyazi', { category: 'doga', order: 8, location: { lat: 40.1888, lng: 28.6787 }, durationMinutes: 150 }),
  base('iskender', { category: 'lezzet', order: 9 }),
  base('kestane', { category: 'lezzet', order: 10 }),
  base('konumsuz', { order: 11, mustSee: true }),
];

const placeIds = (items: PlanItem[]) => items.flatMap((i) => (i.kind === 'place' ? [i.placeId] : []));
const FRIDAY = '2026-11-13';

describe('Gezimi planla', () => {
  it('konum ve saat doğrulaması; bağlantıdan konum', () => {
    expect(parseGeo('40.1826, 29.0619')).toEqual({ lat: 40.1826, lng: 29.0619 });
    expect(parseGeo('https://www.google.com/maps/place/Ulu+Camii/@40.1838113,29.0617,17z/data=!3d40.18381!4d29.06172')).toEqual({ lat: 40.18381, lng: 29.06172 });
    expect(parseGeo('https://maps.google.com/?q=40.18,29.06')).toEqual({ lat: 40.18, lng: 29.06 });
    expect(parseGeo('https://maps.app.goo.gl/abc')).toBeNull();
    expect(parseGeo('Bursa')).toBeNull();
    expect(validHours({ allDay: false, open: '09:00', close: '18:00', closedDays: [1], prayer: false })).toBe(true);
    expect(validHours({ allDay: false, open: '18:00', close: '09:00', closedDays: [], prayer: false })).toBe(false);
    expect(validHours({ allDay: true, closedDays: [7], prayer: false })).toBe(false);
    const p = PLACES[0]!;
    expect(validateTravelPlace({ ...p, durationMinutes: 5 })).toContain('duration');
    expect(validateTravelPlace({ ...p, location: { lat: 99, lng: 29 } })).toContain('location');
    expect(validateTravelPlace(p)).toEqual([]);
  });

  it('süre tahmini, açık mı, cuma namazı', () => {
    expect(weekdayOf(FRIDAY)).toBe(5);
    expect(moveBetween(PLACES[0]!.location!, PLACES[1]!.location!).mode).toBe('yuruyus');
    expect(moveBetween(PLACES[0]!.location!, PLACES[7]!.location!)).toMatchObject({ mode: 'araba' });
    const ulu = PLACES[0]!;
    expect(fitsAt(ulu, FRIDAY, 9 * 60, 45)).toBe(true);
    expect(fitsAt(ulu, FRIDAY, 12 * 60 + 30, 45)).toBe(false);
    expect(fitsAt(ulu, '2026-11-14', 12 * 60 + 30, 45)).toBe(true);
    const koza = PLACES[1]!;
    expect(fitsAt(koza, '2026-11-15', 10 * 60, 60)).toBe(false); // pazar kapalı
    expect(openNow(koza, FRIDAY, 18 * 60)).toEqual({ open: true, closes: 19 * 60 });
    expect(openNow(koza, FRIDAY, 20 * 60)).toEqual({ open: false });
    expect(openNow(PLACES[6]!, FRIDAY, 10 * 60)).toBeUndefined();
  });

  it('program: günler, yemek molaları, kurallar', () => {
    const plan = buildPlan('16', PLACES, { days: 2, interests: ['tarih'], pace: 'dolu', startDate: FRIDAY });
    expect(plan.days).toHaveLength(2);
    const all = plan.days.flatMap((d) => placeIds(d.items));
    // Her yer bir kez; konumsuz ve yemek yerleri programda yok.
    expect(new Set(all).size).toBe(all.length);
    expect(all).not.toContain('konumsuz');
    expect(all).not.toContain('iskender');
    // Mutlaka görülecekler ilk gün.
    expect(placeIds(plan.days[0]!.items)).toEqual(expect.arrayContaining(['ulu', 'yesil']));
    for (const d of plan.days) {
      const meals = d.items.filter((i) => i.kind === 'meal');
      expect(meals.map((m) => m.kind === 'meal' && m.meal)).toEqual(['ogle', 'aksam']);
      expect(meals.every((m) => m.kind === 'meal' && ['iskender', 'kestane'].includes(m.foodId!))).toBe(true);
      // Saatler sırayla ilerler, uyarı yok.
      for (let i = 1; i < d.items.length; i++) expect(d.items[i]!.start).toBeGreaterThanOrEqual(d.items[i - 1]!.end);
      expect(d.items.some((i) => i.kind === 'place' && i.warn)).toBe(false);
    }
    // Cuma: camiler 12:00-14:00 arasına konmaz.
    for (const it of plan.days[0]!.items) {
      if (it.kind === 'place' && ['ulu', 'emir'].includes(it.placeId)) expect(it.end <= 12 * 60 || it.start >= 14 * 60).toBe(true);
    }
    expect(hhmm(plan.days[0]!.items[0]!.start)).toBe('09:00');
  });

  it('sakin tempo daha az durak; tek gün', () => {
    const dolu = buildPlan('16', PLACES, { days: 1, interests: [], pace: 'dolu', startDate: FRIDAY });
    const sakin = buildPlan('16', PLACES, { days: 1, interests: [], pace: 'sakin', startDate: FRIDAY });
    expect(placeIds(sakin.days[0]!.items).length).toBeLessThanOrEqual(4);
    expect(placeIds(sakin.days[0]!.items).length).toBeLessThanOrEqual(placeIds(dolu.days[0]!.items).length);
  });

  it('değiştir, çıkar, yarına taşı', () => {
    let plan = buildPlan('16', PLACES, { days: 2, interests: ['tarih'], pace: 'sakin', startDate: '2026-11-14' });
    const first = placeIds(plan.days[0]!.items);
    const target = first[first.length - 1]!;
    const alts = alternativesFor(plan, 0, target, PLACES);
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.every((a) => !plan.days.flatMap((d) => placeIds(d.items)).includes(a.place.id))).toBe(true);
    plan = replaceStop(plan, 0, target, alts[0]!.place.id, PLACES);
    expect(placeIds(plan.days[0]!.items)).toContain(alts[0]!.place.id);
    plan = removeStop(plan, 0, alts[0]!.place.id, PLACES);
    expect(placeIds(plan.days[0]!.items)).toHaveLength(first.length - 1);
    const moved = moveToNextDay(plan, 0, first[0]!, PLACES)!;
    expect(placeIds(moved.days[1]!.items)[0]).toBe(first[0]);
    expect(placeIds(moved.days[0]!.items)).not.toContain(first[0]);
    expect(moveToNextDay(plan, 1, placeIds(plan.days[1]!.items)[0]!, PLACES)).toBeNull();
  });

  it('konumu olan yer yoksa program boş', () => {
    const plan = buildPlan('16', [PLACES[8]!, PLACES[10]!], { days: 2, interests: [], pace: 'dolu', startDate: FRIDAY });
    expect(plan.days).toEqual([]);
  });
});
