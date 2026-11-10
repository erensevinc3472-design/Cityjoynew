import type { Photo } from '../media/photo';

/**
 * Sponsor bandı (Eren, 11 Kasım 2026; PROJE.md 15 gelir: belediye tanıtım protokolü, sponsorluk). Sosyal Harmoni ve
 * Fırsatlar sayfalarının altında ince, her zaman "Sponsorlu" etiketli bir bant. Anlaşma uygulama dışında faturayla
 * yapılır; sponsoru yalnızca admin (merkez) panelden ekler. İl seçilirse yalnızca o ilde, "TR" ise her ilde görünür;
 * ilin kendi sponsoru Türkiye geneli sponsordan önce gelir. Süresi dolan ya da kapatılan sponsor görünmez.
 */
export const SPONSOR_PLACES = ['sosyal', 'firsatlar'] as const;
export type SponsorPlace = (typeof SPONSOR_PLACES)[number];

/** Türkiye geneli sponsorun il alanı. */
export const SPONSOR_NATIONWIDE = 'TR';

export const SPONSOR_LIMITS = { name: [2, 60], line: [3, 90], url: 300, maxDays: 400 } as const;

export interface SponsorInput {
  /** "Osmangazi Belediyesi". */
  name: string;
  /** Tek satır: "Bu sayfa Osmangazi Belediyesi katkılarıyla". */
  line: string;
  /** Dokununca açılan resmî sayfa (https); boşsa bant dokunulmaz. */
  url?: string;
  logo?: Photo;
  /** İl kodu ya da `SPONSOR_NATIONWIDE`. */
  provinceCode: string;
  places: SponsorPlace[];
  /** YYYY-AA-GG, iki gün de dahil. */
  startsOn: string;
  endsOn: string;
  /** Kapatılan sponsor tarihine bakılmadan gizlenir. */
  active: boolean;
}

export interface Sponsor extends SponsorInput {
  id: string;
  updatedAt: string;
}

export type SponsorError = 'name' | 'line' | 'url' | 'places' | 'dates';

const len = (s: string | undefined) => (s ?? '').trim().length;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
export const sponsorUrlOk = (u: string) => /^https:\/\/[^\s]+$/i.test(u) && u.length <= SPONSOR_LIMITS.url;

export function validateSponsor(s: SponsorInput): SponsorError[] {
  const e: SponsorError[] = [];
  if (len(s.name) < SPONSOR_LIMITS.name[0] || len(s.name) > SPONSOR_LIMITS.name[1]) e.push('name');
  if (len(s.line) < SPONSOR_LIMITS.line[0] || len(s.line) > SPONSOR_LIMITS.line[1]) e.push('line');
  if (s.url && !sponsorUrlOk(s.url.trim())) e.push('url');
  if (!s.places.length || s.places.some((p) => !SPONSOR_PLACES.includes(p))) e.push('places');
  const days = (Date.parse(s.endsOn) - Date.parse(s.startsOn)) / 86_400_000;
  if (!YMD.test(s.startsOn) || !YMD.test(s.endsOn) || !(days >= 0) || days > SPONSOR_LIMITS.maxDays) e.push('dates');
  return e;
}

/** Yerel gün (YYYY-AA-GG). */
export const ymdOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function sponsorLive(s: Pick<Sponsor, 'active' | 'startsOn' | 'endsOn'>, now = new Date()): boolean {
  const today = ymdOf(now);
  return s.active && s.startsOn <= today && today <= s.endsOn;
}

/**
 * Sayfada gösterilecek sponsor: önce ilin kendi sponsorları, yoksa Türkiye geneli. Birden çok varsa her gün sırayla
 * biri (adil dönüşüm, kimse sürekli öne geçmez).
 */
export function pickSponsor(list: Sponsor[], provinceCode: string, place: SponsorPlace, now = new Date()): Sponsor | undefined {
  const live = list.filter((s) => s.places.includes(place) && sponsorLive(s, now));
  const own = live.filter((s) => s.provinceCode === provinceCode);
  const pool = (own.length ? own : live.filter((s) => s.provinceCode === SPONSOR_NATIONWIDE)).sort((a, b) => a.id.localeCompare(b.id));
  if (!pool.length) return undefined;
  const day = Math.floor(Date.parse(ymdOf(now)) / 86_400_000);
  return pool[day % pool.length];
}
