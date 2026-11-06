/**
 * Basın Masası > Yayın öncesi kontrol listesi (PROJE.md 6.2, Karar Eren 5 Kasım 2026). Duyuru formunda, yayınlamadan
 * önce metni denetler. "hata" yayını durdurur (doldurulmamış [boşluk]); "uyari" yalnızca hatırlatır.
 */

import type { AnnouncementInput } from '../announcements/announcements';
import { occurrencesBetween, type ImportantDay } from './important-days';
import { placeholdersIn } from './templates';

export type CheckLevel = 'tamam' | 'uyari' | 'hata';
export type CheckKey = 'bosluk' | 'baslikUzun' | 'buyukHarf' | 'unlem' | 'tarihYok' | 'bitisYok' | 'onemliGun' | 'bolge';

export interface Check {
  key: CheckKey;
  level: CheckLevel;
  /** Metne yerleştirilecek değerler (boşluk listesi, gün adı...). */
  vars?: Record<string, string | number>;
}

/** Telefonda listede tek satırda okunabilen başlık uzunluğu. */
export const TITLE_COMFORT = 60;

const hasDateOrTime = (s: string) =>
  /\b\d{1,2}[./]\d{1,2}([./]\d{2,4})?\b/.test(s) || /\b\d{1,2}[.:]\d{2}\b/.test(s) ||
  /(?<!\p{L})(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık|pazartesi|salı|çarşamba|perşembe|cuma|cumartesi|pazar|yarın|bugün|bu akşam|bu hafta)(?!\p{L})/iu.test(s);

/**
 * Kontroller: doldurulmamış boşluk (hata), uzun başlık, tamamı büyük harf başlık, fazla ünlem, duyuruda tarih / saat
 * yok, tarihli duyuruda bitiş yok, yayın günü bir önemli güne denk geliyor (ton hatırlatması), hedef bölge özeti.
 */
export function prePublishChecks(input: AnnouncementInput, opts: { regionLabel: string; days?: readonly ImportantDay[]; now?: Date }): Check[] {
  const now = opts.now ?? new Date();
  const text = `${input.title}\n${input.body}`;
  const out: Check[] = [];
  const blanks = placeholdersIn(text);
  out.push(blanks.length ? { key: 'bosluk', level: 'hata', vars: { list: blanks.join(', ') } } : { key: 'bosluk', level: 'tamam' });
  const title = input.title.trim();
  out.push({ key: 'baslikUzun', level: title.length > TITLE_COMFORT ? 'uyari' : 'tamam', vars: { count: title.length, max: TITLE_COMFORT } });
  const letters = title.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, '');
  if (letters.length >= 6 && letters === letters.toLocaleUpperCase('tr')) out.push({ key: 'buyukHarf', level: 'uyari' });
  if (/!{2,}/.test(text) || (text.match(/!/g)?.length ?? 0) > 3) out.push({ key: 'unlem', level: 'uyari' });
  if (input.kind === 'duyuru') {
    const dated = hasDateOrTime(text);
    out.push({ key: 'tarihYok', level: dated ? 'tamam' : 'uyari' });
    if (dated && !input.endsAt && !input.pinned) out.push({ key: 'bitisYok', level: 'uyari' });
  }
  if (opts.days?.length && input.kind !== 'acil') {
    const at = input.scheduledAt ? new Date(input.scheduledAt) : now;
    const from = new Date(at.getFullYear(), at.getMonth(), at.getDate());
    const day = occurrencesBetween(opts.days, from, new Date(from.getTime() + 86400000)).find((o) => o.day.kind === 'anma' || o.day.kind === 'resmi' || o.day.kind === 'dini');
    if (day) out.push({ key: 'onemliGun', level: 'uyari', vars: { day: day.day.title } });
  }
  out.push({ key: 'bolge', level: 'tamam', vars: { region: opts.regionLabel } });
  return out;
}
