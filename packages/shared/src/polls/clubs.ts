/**
 * Şehir Kulüpleri (PROJE.md 5.3, 13. madde 35). Kulüpleri il yöneticisi panelden ekler ve doğrular (kulüp belgeyle
 * başvurur; belge yükleme Blaze ile); üstteki "Şehrin kulübü"nü il yöneticisi seçer (ilde tek). Fikstür kulüpten gelir:
 * kulübün yetkili hesabı ya da il yöneticisi panelden girer. Canlı skor yok (lisanslı veri ücretli).
 */
export const CLUB_SPORTS = ['futbol', 'basketbol', 'voleybol', 'amator', 'diger'] as const;
export type ClubSport = (typeof CLUB_SPORTS)[number];

export const CLUB_LIMITS = { name: [2, 60], short: [1, 4], venue: 80, opponent: [2, 60], fixtures: 12, url: 300 } as const;

export interface ClubFixture {
  /** ISO tarih-saat. */
  at: string;
  opponent: string;
  home: boolean;
  venue?: string;
  ticketUrl?: string;
}

export interface ClubInput {
  name: string;
  /** Rozetteki kısaltma ("BS"). */
  short: string;
  sport: ClubSport;
  provinceCode: string;
  districtId?: string;
  website?: string;
  fixtures: ClubFixture[];
}

export interface Club extends ClubInput {
  id: string;
  verified: boolean;
  featured: boolean;
  hidden: boolean;
  /** Fikstürü girebilen kulüp yetkilileri (kullanıcı kimliği). */
  managerUids: string[];
  updatedAt: string;
}

const len = (s: string | undefined) => (s ?? '').trim().length;

export type ClubError = 'name' | 'short' | 'website' | 'fixtures';

export function validateClub(c: ClubInput): ClubError[] {
  const e: ClubError[] = [];
  if (len(c.name) < CLUB_LIMITS.name[0] || len(c.name) > CLUB_LIMITS.name[1]) e.push('name');
  if (len(c.short) < CLUB_LIMITS.short[0] || len(c.short) > CLUB_LIMITS.short[1]) e.push('short');
  if (c.website && !/^https:\/\/[^\s]+$/i.test(c.website)) e.push('website');
  if (
    c.fixtures.length > CLUB_LIMITS.fixtures ||
    c.fixtures.some(
      (f) =>
        isNaN(Date.parse(f.at)) ||
        len(f.opponent) < CLUB_LIMITS.opponent[0] ||
        len(f.opponent) > CLUB_LIMITS.opponent[1] ||
        len(f.venue) > CLUB_LIMITS.venue ||
        (!!f.ticketUrl && !/^https:\/\/[^\s]+$/i.test(f.ticketUrl)),
    )
  )
    e.push('fixtures');
  return e;
}

/** Sıradaki maç (şimdiden sonraki ilk maç). */
export function nextFixture(c: Pick<Club, 'fixtures'>, now = new Date()): ClubFixture | undefined {
  return [...c.fixtures].filter((f) => new Date(f.at).getTime() > now.getTime() - 2 * 3600_000).sort((a, b) => a.at.localeCompare(b.at))[0];
}

/** Liste: önce şehrin kulübü, sonra doğrulanmışlar, sonra ada göre. */
export function sortClubs(list: readonly Club[]): Club[] {
  return [...list].filter((c) => !c.hidden).sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.verified) - Number(a.verified) || a.name.localeCompare(b.name, 'tr'));
}
