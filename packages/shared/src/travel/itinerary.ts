import { distanceKm } from '../business/business';
import { minutesOf, TRAVEL_CATEGORIES, type LatLng, type TravelCategory, type TravelPlace } from './travel';

/**
 * Seyahat > Gezimi planla (Karar, Eren, 12 Kasım 2026; Hazır Rotalar'ın yerine). Kullanıcı gün sayısını, ilgi
 * alanlarını ve temposunu seçer; program bizim yer verimizden kurallarla kurulur. Yapay zekâ ya da ücretli harita servisi
 * kullanılmaz (maliyet ilkesi): iki yer arası süre kuş uçuşu mesafeden tahmin edilir ve "yaklaşık" diye gösterilir.
 * Konumu girilmemiş yer programa girmez. "Lezzet" kategorisindeki yerler (yemekler) yemek molasında önerilir.
 */

export type PlanPace = 'sakin' | 'dolu';
/** Seçilebilen ilgi alanları (yer kategorileri; lezzet yemek molası olarak girer). */
export const PLAN_INTERESTS: readonly TravelCategory[] = TRAVEL_CATEGORIES;
export const PLAN_MAX_DAYS = 5;

export interface PlanPrefs {
  days: number;
  interests: TravelCategory[];
  pace: PlanPace;
  /** İlk günün tarihi, "2026-11-13". */
  startDate: string;
  /** Kalınan yer ya da kullanıcının konumu; her gün buradan başlanır. */
  from?: LatLng;
}

export interface PlanMove {
  mode: 'yuruyus' | 'araba';
  minutes: number;
  km: number;
}

/** Program öğesi. Saatler gün içindeki dakika (540 = 09:00). */
export type PlanItem =
  | { kind: 'place'; placeId: string; start: number; end: number; move?: PlanMove; warn?: 'kapali' | 'gec' }
  | { kind: 'meal'; meal: 'ogle' | 'aksam'; start: number; end: number; foodId?: string };

export interface PlanDay {
  date: string;
  items: PlanItem[];
}

export interface Itinerary {
  cityId: string;
  prefs: PlanPrefs;
  days: PlanDay[];
  createdAt: string;
}

const PACE = {
  dolu: { start: 9 * 60, end: 20 * 60, max: 6, lunch: 60, dinner: 75, stay: 1 },
  sakin: { start: 9 * 60 + 30, end: 18 * 60 + 30, max: 4, lunch: 90, dinner: 90, stay: 1.25 },
} as const;

/** Kalış süresi girilmemişse kategoriye göre tahmin (dakika). */
const DEFAULT_STAY: Record<TravelCategory, number> = { tarih: 50, kultur: 60, alisveris: 60, doga: 120, deniz: 120, lezzet: 45 };
/** Açılış saati girilmemiş yer için varsayılan pencere. */
const UNKNOWN_HOURS: [number, number] = [9 * 60, 19 * 60];
/** Cuma namazı için ziyaretten kaçınılan aralık (mevsime göre değişir; güvenli geniş aralık). */
const FRIDAY_PRAYER: [number, number] = [12 * 60, 14 * 60];
const LUNCH_FROM = 11 * 60 + 45;

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
/** Saatler 5 dakikaya yuvarlanır (09:03 yerine 09:05). */
const up5 = (n: number) => Math.ceil(n / 5) * 5;

/** Haftanın günü (0 = pazar); saat dilimi kaymasın diye öğlen UTC. */
export const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Yaklaşık yol: kuş uçuşu × 1,3. 1,6 km'ye kadar yürüyüş, ötesi araba (taksi ya da kendi aracı). */
export function moveBetween(a: LatLng, b: LatLng): PlanMove {
  const km = Math.round(distanceKm(a, b) * 1.3 * 10) / 10;
  if (km <= 1.6) return { mode: 'yuruyus', km, minutes: Math.max(3, Math.round((km / 4.5) * 60)) };
  return { mode: 'araba', km, minutes: round5(10 + (km / (km > 15 ? 60 : 25)) * 60) };
}

export function stayOf(p: TravelPlace, pace: PlanPace): number {
  return round5((p.durationMinutes ?? DEFAULT_STAY[p.category]) * PACE[pace].stay);
}

/** O gün açık olduğu aralık; kapalıysa null. */
export function openWindow(p: TravelPlace, date: string): [number, number] | null {
  const h = p.hours;
  if (!h) return UNKNOWN_HOURS;
  if (h.closedDays.includes(weekdayOf(date))) return null;
  if (h.allDay) return [0, 24 * 60];
  return [minutesOf(h.open!), minutesOf(h.close!)];
}

/** Yer, verilen saatte başlanıp kalış süresince gezilebilir mi (açık mı, cuma namazına denk geliyor mu)? */
export function fitsAt(p: TravelPlace, date: string, start: number, stay: number): boolean {
  const w = openWindow(p, date);
  if (!w || start < w[0] || start + stay > w[1]) return false;
  if (p.hours?.prayer && weekdayOf(date) === 5 && start < FRIDAY_PRAYER[1] && start + stay > FRIDAY_PRAYER[0]) return false;
  return true;
}

/** Bugün şu an açık mı? (Yakınımda) Saat girilmemişse bilinmiyor: undefined. */
export function openNow(p: TravelPlace, date: string, minutes: number): { open: boolean; closes?: number } | undefined {
  if (!p.hours) return undefined;
  const w = openWindow(p, date);
  if (!w) return { open: false };
  const open = minutes >= w[0] && minutes < w[1];
  return { open, ...(open && !p.hours.allDay ? { closes: w[1] } : {}) };
}

const planPool = (places: TravelPlace[]) => places.filter((p) => p.location && p.category !== 'lezzet');
const foodsOf = (places: TravelPlace[]) => places.filter((p) => p.category === 'lezzet');

function scoreOf(p: TravelPlace, interests: TravelCategory[]): number {
  const liked = !interests.length || interests.includes(p.category);
  return (p.mustSee ? 30 : 0) + (liked ? 25 : 0) - Math.min(p.order, 40) * 0.4;
}

/**
 * Verilen sıradaki yerlerin saatlerini hesaplar: yemek molalarını ekler, açık olmayan ya da gün sonunu aşan yeri
 * `warn` ile işaretler (değiştirme ve çıkarmadan sonra da kullanılır).
 */
export function timeDay(placeIds: string[], date: string, prefs: PlanPrefs, places: TravelPlace[], foodOffset = 0): PlanDay {
  const P = PACE[prefs.pace];
  const byId = new Map(places.map((p) => [p.id, p]));
  const foods = foodsOf(places);
  const food = (i: number) => (foods.length ? foods[(foodOffset + i) % foods.length]!.id : undefined);
  const items: PlanItem[] = [];
  let cursor = P.start;
  let pos = prefs.from;
  let lunch = false;
  for (const id of placeIds) {
    const p = byId.get(id);
    if (!p) continue;
    const stay = stayOf(p, prefs.pace);
    const move = pos && p.location ? moveBetween(pos, p.location) : undefined;
    let arrive = up5(cursor + (move?.minutes ?? 0));
    if (!lunch && (arrive >= LUNCH_FROM || arrive + stay > 14 * 60)) {
      const at = Math.max(cursor, 12 * 60);
      if (at < 15 * 60) {
        items.push({ kind: 'meal', meal: 'ogle', start: at, end: at + P.lunch, ...(food(0) ? { foodId: food(0) } : {}) });
        cursor = at + P.lunch;
        arrive = up5(cursor + (move?.minutes ?? 0));
      }
      lunch = true;
    }
    const w = openWindow(p, date);
    // Henüz açılmadıysa açılışı bekle.
    if (w && arrive < w[0] && w[0] - arrive <= 90) arrive = w[0];
    const warn = !fitsAt(p, date, arrive, stay) ? 'kapali' : arrive + stay > P.end ? 'gec' : undefined;
    items.push({ kind: 'place', placeId: id, start: arrive, end: arrive + stay, ...(move ? { move } : {}), ...(warn ? { warn } : {}) });
    cursor = arrive + stay;
    pos = p.location ?? pos;
  }
  if (items.some((i) => i.kind === 'place')) {
    const at = Math.max(cursor, prefs.pace === 'dolu' ? 19 * 60 : 18 * 60 + 30);
    items.push({ kind: 'meal', meal: 'aksam', start: at, end: at + P.dinner, ...(food(1) ? { foodId: food(1) } : {}) });
  }
  return { date, items };
}

/** Programı kurar: her gün en iyi kalan yerden başlar, yakın ve o saatte açık olan yerlerle doldurur. */
export function buildPlan(cityId: string, places: TravelPlace[], prefs: PlanPrefs, now = new Date()): Itinerary {
  const P = PACE[prefs.pace];
  const days = Math.max(1, Math.min(PLAN_MAX_DAYS, Math.round(prefs.days)));
  const pool = planPool(places);
  const used = new Set<string>();
  const out: PlanDay[] = [];
  for (let d = 0; d < days; d++) {
    const date = addDays(prefs.startDate, d);
    const seq: TravelPlace[] = [];
    let cursor = P.start;
    let pos = prefs.from;
    let lunch = false;
    while (seq.length < P.max) {
      if (!lunch && cursor >= LUNCH_FROM) {
        cursor = Math.max(cursor, 12 * 60) + P.lunch;
        lunch = true;
      }
      let best: { p: TravelPlace; value: number; end: number; loc: LatLng } | undefined;
      for (const p of pool) {
        if (used.has(p.id)) continue;
        const stay = stayOf(p, prefs.pace);
        const move = pos ? moveBetween(pos, p.location!) : undefined;
        let arrive = up5(cursor + (move?.minutes ?? 0));
        const w = openWindow(p, date);
        if (w && arrive < w[0] && w[0] - arrive <= 90) arrive = w[0];
        if (arrive + stay > P.end || !fitsAt(p, date, arrive, stay)) continue;
        // Uzak yer (araba) puandan düşer; ilk durakta mesafe yok.
        const value = scoreOf(p, prefs.interests) - (move ? move.minutes * 0.7 + (move.mode === 'araba' ? 6 : 0) : 0) - (arrive - cursor - (move?.minutes ?? 0)) * 0.3;
        if (!best || value > best.value) best = { p, value, end: arrive + stay, loc: p.location! };
      }
      if (!best) break;
      seq.push(best.p);
      used.add(best.p.id);
      cursor = best.end;
      pos = best.loc;
    }
    if (!seq.length) break;
    out.push(timeDay(seq.map((p) => p.id), date, prefs, places, d * 2));
  }
  return { cityId, prefs: { ...prefs, days }, days: out, createdAt: now.toISOString() };
}

const placeIdsOf = (day: PlanDay) => day.items.flatMap((i) => (i.kind === 'place' ? [i.placeId] : []));
const foodOffsetOf = (plan: Itinerary, dayIndex: number) => dayIndex * 2;

function withDay(plan: Itinerary, dayIndex: number, ids: string[], places: TravelPlace[]): Itinerary {
  const days = plan.days.map((d, i) => (i === dayIndex ? timeDay(ids, d.date, plan.prefs, places, foodOffsetOf(plan, i)) : d));
  return { ...plan, days };
}

/** Bir durağı başka bir yerle değiştirir ve günün saatlerini yeniden hesaplar. */
export function replaceStop(plan: Itinerary, dayIndex: number, placeId: string, withId: string, places: TravelPlace[]): Itinerary {
  return withDay(plan, dayIndex, placeIdsOf(plan.days[dayIndex]!).map((id) => (id === placeId ? withId : id)), places);
}

export function removeStop(plan: Itinerary, dayIndex: number, placeId: string, places: TravelPlace[]): Itinerary {
  return withDay(plan, dayIndex, placeIdsOf(plan.days[dayIndex]!).filter((id) => id !== placeId), places);
}

/** Durağı ertesi günün başına taşır (gecikince "yarına alalım mı?"). Son günse yeni gün açılmaz: null. */
export function moveToNextDay(plan: Itinerary, dayIndex: number, placeId: string, places: TravelPlace[]): Itinerary | null {
  const next = plan.days[dayIndex + 1];
  if (!next) return null;
  const moved = withDay(plan, dayIndex, placeIdsOf(plan.days[dayIndex]!).filter((id) => id !== placeId), places);
  return withDay(moved, dayIndex + 1, [placeId, ...placeIdsOf(next)], places);
}

/** Değiştirmek için öneriler: programda olmayan, öncekine yakın ve o saatte açık yerler (en iyi `n` tanesi). */
export function alternativesFor(plan: Itinerary, dayIndex: number, placeId: string, places: TravelPlace[], n = 4): { place: TravelPlace; move?: PlanMove; fits: boolean }[] {
  const day = plan.days[dayIndex]!;
  const inPlan = new Set(plan.days.flatMap(placeIdsOf));
  const idx = day.items.findIndex((i) => i.kind === 'place' && i.placeId === placeId);
  const item = day.items[idx];
  const prev = [...day.items.slice(0, idx)].reverse().find((i) => i.kind === 'place');
  const byId = new Map(places.map((p) => [p.id, p]));
  const from = (prev && prev.kind === 'place' ? byId.get(prev.placeId)?.location : undefined) ?? plan.prefs.from;
  return planPool(places)
    .filter((p) => !inPlan.has(p.id))
    .map((p) => {
      const move = from ? moveBetween(from, p.location!) : undefined;
      const fits = item ? fitsAt(p, day.date, item.start, stayOf(p, plan.prefs.pace)) : true;
      return { place: p, move, fits, value: scoreOf(p, plan.prefs.interests) - (move?.minutes ?? 0) * 0.7 - (fits ? 0 : 40) };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, n)
    .map(({ place, move, fits }) => ({ place, move, fits }));
}

/** Programdaki yerlerden en az birine konum girilmiş mi (planlayıcı kullanılabilir mi)? */
export const canPlan = (places: TravelPlace[]) => planPool(places).length > 0;

/** "Şu an" için: bugünkü günde şu anki ya da sıradaki öğe. */
export function nowInDay(day: PlanDay, minutes: number): { index: number; current: boolean } | null {
  const i = day.items.findIndex((x) => minutes < x.end);
  if (i < 0) return null;
  const it = day.items[i]!;
  return { index: i, current: minutes >= it.start };
}

export const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
