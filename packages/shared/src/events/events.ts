import { regionWithin, type AnnouncementAuthor, type AnnouncementRegion, type AnnouncementStatus } from '../announcements/announcements';
import type { RegionScope } from '../permissions/types';

/**
 * Etkinlikler (PROJE.md 5.3, 6.2 madde 3): yalnızca yetkili kurum ve kişiler açar (belediye, kurum / STK, muhtar,
 * il yöneticisi). Hazırla > onayla > yayınla akışı duyurularla aynıdır. Halka açık etkinlikte adres herkese görünür;
 * bilet satılmaz, yalnızca resmî bilet bağlantısı verilir; siyasi parti etkinliği, miting ve gösteri açılamaz.
 * Kullanıcı "Katılıyorum" der; adı organizatöre yalnızca kendi izniyle görünür.
 */

export const EVENT_CATEGORIES = [
  'kultur-sanat',
  'muzik',
  'tiyatro-sinema',
  'spor',
  'cocuk-aile',
  'egitim-seminer',
  'festival-senlik',
  'saglik',
  'gonulluluk',
  'diger',
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

/** Duyuru durumlarına ek olarak "iptal": iptal edilen etkinlik bitişine kadar "İptal edildi" etiketiyle görünür. */
export type EventStatus = AnnouncementStatus | 'iptal';

export interface EventInput {
  title: string;
  description: string;
  category: EventCategory;
  /** ISO tarihler. */
  startsAt: string;
  endsAt: string;
  venueName: string;
  /** Açık adres (halka açık etkinlikte herkese görünür). */
  address?: string;
  region: AnnouncementRegion;
  free: boolean;
  /** Ücretliyse kısa bilgi: "50 TL", "öğrenciye 25 TL". */
  priceNote?: string;
  /** Resmî bilet ya da kayıt bağlantısı (https). Uygulama bilet satmaz. */
  ticketUrl?: string;
  /** Kontenjan; boşsa sınırsız. "Katılıyorum" sayısı dolunca yeni katılım alınmaz. */
  capacity?: number;
}

export interface CityEvent extends EventInput {
  id: string;
  author: AnnouncementAuthor;
  status: EventStatus;
  preparedBy: string;
  preparedByName: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
  attendeeCount: number;
}

export const EVENT_LIMITS = {
  title: [3, 100],
  description: [10, 3000],
  venueName: [2, 120],
  address: 200,
  priceNote: 80,
  ticketUrl: 300,
  capacity: [1, 100000],
  /** Bir etkinlik en çok bu kadar gün sürer (festival gibi). */
  maxDays: 60,
} as const;

export type EventError = 'title' | 'description' | 'category' | 'dates' | 'venue' | 'address' | 'price' | 'ticketUrl' | 'capacity' | 'region';

export function validateEvent(e: EventInput, scope: RegionScope, now = new Date()): EventError[] {
  const errors: EventError[] = [];
  const len = (s: string | undefined) => (s ?? '').trim().length;
  const within = (n: number, [min, max]: readonly [number, number]) => n >= min && n <= max;
  if (!within(len(e.title), EVENT_LIMITS.title)) errors.push('title');
  if (!within(len(e.description), EVENT_LIMITS.description)) errors.push('description');
  if (!EVENT_CATEGORIES.includes(e.category)) errors.push('category');
  const start = new Date(e.startsAt).getTime();
  const end = new Date(e.endsAt).getTime();
  if (!(start <= end) || !(end > now.getTime()) || end - start > EVENT_LIMITS.maxDays * 86400000) errors.push('dates');
  if (!within(len(e.venueName), EVENT_LIMITS.venueName)) errors.push('venue');
  if (len(e.address) > EVENT_LIMITS.address) errors.push('address');
  if (!e.free && !len(e.priceNote)) errors.push('price');
  if (len(e.priceNote) > EVENT_LIMITS.priceNote) errors.push('price');
  if (e.ticketUrl && (!/^https:\/\/[^\s]+\.[^\s]+$/.test(e.ticketUrl.trim()) || e.ticketUrl.length > EVENT_LIMITS.ticketUrl)) errors.push('ticketUrl');
  if (e.capacity !== undefined && (!Number.isInteger(e.capacity) || !within(e.capacity, EVENT_LIMITS.capacity))) errors.push('capacity');
  const r = e.region;
  if (!/^[0-8][0-9]$/.test(r.provinceCode) || (r.neighbourhoodId && !r.districtId) || !regionWithin(r, scope)) errors.push('region');
  return errors;
}

/** Uygulamada görünür mü: yayında ya da iptal edilmiş, bitmemiş. */
export function isEventVisible(e: Pick<CityEvent, 'status' | 'endsAt'>, now = new Date()): boolean {
  return (e.status === 'yayinda' || e.status === 'iptal') && new Date(e.endsAt) > now;
}

/** Kalan yer; kontenjan yoksa null. */
export function remainingSeats(e: Pick<CityEvent, 'capacity' | 'attendeeCount'>): number | null {
  return e.capacity ? Math.max(0, e.capacity - e.attendeeCount) : null;
}

/** Yaklaşan etkinlikler başlama sırasıyla; iptaller en sonda. */
export function sortEvents<T extends Pick<CityEvent, 'startsAt' | 'status'>>(list: T[]): T[] {
  return [...list].sort((a, b) => Number(a.status === 'iptal') - Number(b.status === 'iptal') || a.startsAt.localeCompare(b.startsAt));
}
