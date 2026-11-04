/**
 * Seyahat > Planla = tatil keşfi (PROJE.md 5.2, Eren 3 Kasım 2026). Akış: Türkiye / Yurt dışı > tatil fikri > o temaya
 * uyan yerler > yerin konaklaması > tesis sayfası (rezervasyon tesisle doğrudan). Konaklama işletmelerden kendiliğinden
 * gelir: "Otel ve konaklama" türündeki işletme tesis türünü, tatil fikirlerini, belge numarasını ve gece fiyat aralığını
 * girer; belgesi onaylanınca (işletme doğrulaması) kendi ilinin ve seçtiği temaların listesine düşer. Bir il, o temayla
 * işaretli en az bir doğrulanmış tesisi varsa temanın listesine girer; ekip panelden sıralar, gizler, dönem ve not yazar.
 */
export const HOLIDAY_THEMES = [
  { id: 'deniz', icon: 'beach-access' },
  { id: 'kayak', icon: 'downhill-skiing' },
  { id: 'termal', icon: 'hot-tub' },
  { id: 'kultur', icon: 'account-balance' },
  { id: 'doga', icon: 'forest' },
  { id: 'lezzet', icon: 'restaurant' },
  { id: 'aile', icon: 'family-restroom' },
  { id: 'balayi', icon: 'favorite' },
  { id: 'gorulmesi-gereken', icon: 'star' },
] as const;
export type HolidayTheme = (typeof HOLIDAY_THEMES)[number]['id'];
export const HOLIDAY_THEME_IDS = HOLIDAY_THEMES.map((x) => x.id) as HolidayTheme[];
export const isHolidayTheme = (s: string): s is HolidayTheme => (HOLIDAY_THEME_IDS as string[]).includes(s);

/** "Otel ve konaklama" işletmesinin tesis türü; yeme-içme türleri gibi categoryIds içinde "konak-" önekiyle tutulur. */
export const LODGING_KINDS = [
  { id: 'konak-otel', icon: 'hotel' },
  { id: 'konak-butik', icon: 'villa' },
  { id: 'konak-termal', icon: 'hot-tub' },
  { id: 'konak-pansiyon', icon: 'house' },
  { id: 'konak-apart', icon: 'apartment' },
  { id: 'konak-gunluk-ev', icon: 'key' },
  { id: 'konak-bungalov', icon: 'cabin' },
  { id: 'konak-kamp', icon: 'holiday-village' },
] as const;
export type LodgingKindId = (typeof LODGING_KINDS)[number]['id'];
export const isLodgingKind = (id: string): id is LodgingKindId => LODGING_KINDS.some((k) => k.id === id);

export const LODGING_LIMITS = { themes: 4, license: [3, 40], price: 1_000_000, url: 300 } as const;

/**
 * Konaklama bilgisi. Belge numarası zorunlu: otel ve benzerinde Kültür ve Turizm Bakanlığı ya da belediye işletme
 * belgesi; günlük kiralık evde 7464 sayılı Kanun'a göre izin belgesi (avukatla teyit edilecek). Ücret tablosu
 * işletmenin fiyat listesinde (sezon, kişi/çocuk, ek ücret, depozito, iptal).
 */
export interface LodgingInfo {
  themes: HolidayTheme[];
  licenseNo: string;
  /** Gece fiyat aralığı (TL); kartta "1.800-3.200 TL / gece". */
  nightMin?: number;
  nightMax?: number;
  /** Pro: web sitesi düğmesi. */
  website?: string;
}

export type LodgingError = 'themes' | 'license' | 'price' | 'website';

export function validateLodging(l: LodgingInfo | undefined): LodgingError[] {
  if (!l) return ['license'];
  const e: LodgingError[] = [];
  if (!l.themes.length || l.themes.length > LODGING_LIMITS.themes || l.themes.some((x) => !isHolidayTheme(x))) e.push('themes');
  const lic = l.licenseNo.trim().length;
  if (lic < LODGING_LIMITS.license[0] || lic > LODGING_LIMITS.license[1]) e.push('license');
  const ok = (n: number | undefined) => n === undefined || (Number.isInteger(n) && n > 0 && n <= LODGING_LIMITS.price);
  if (!ok(l.nightMin) || !ok(l.nightMax) || (l.nightMin !== undefined && l.nightMax !== undefined && l.nightMin > l.nightMax)) e.push('price');
  if (l.website && (!/^https:\/\/[^\s]+$/.test(l.website.trim()) || l.website.trim().length > LODGING_LIMITS.url)) e.push('website');
  return e;
}

export function cleanLodging(l: LodgingInfo): LodgingInfo {
  return {
    themes: HOLIDAY_THEME_IDS.filter((x) => l.themes.includes(x)),
    licenseNo: l.licenseNo.trim(),
    ...(l.nightMin !== undefined ? { nightMin: l.nightMin } : {}),
    ...(l.nightMax !== undefined ? { nightMax: l.nightMax } : {}),
    ...(l.website?.trim() ? { website: l.website.trim() } : {}),
  };
}

/** Ekibin bir temadaki il düzenlemesi (Panel > Seyahat > Tatil fikirleri). */
export interface HolidayPlaceCuration {
  /** Küçük önce; verilmeyenler tesis sayısına göre sonra. */
  rank?: number;
  hidden?: boolean;
  /** "Haziran-Eylül" gibi en iyi dönem. */
  season?: string;
  note?: string;
}
export type HolidayCuration = Record<string, HolidayPlaceCuration>;
export const HOLIDAY_CURATION_LIMITS = { season: 40, note: 160 } as const;

export interface HolidayPlace {
  provinceCode: string;
  count: number;
  nightMin?: number;
  nightMax?: number;
  season?: string;
  note?: string;
  rank?: number;
}

type LodgingLike = { location: { provinceCode: string }; lodging?: LodgingInfo };

/** Temanın yerleri: tesisleri ile göre toplar, ekibin gizlediğini çıkarır, sıraya koyar. */
export function holidayPlaces(list: readonly LodgingLike[], curation: HolidayCuration = {}): HolidayPlace[] {
  const by = new Map<string, HolidayPlace>();
  for (const b of list) {
    const code = b.location.provinceCode;
    const p = by.get(code) ?? { provinceCode: code, count: 0 };
    p.count += 1;
    const lo = b.lodging?.nightMin ?? b.lodging?.nightMax;
    const hi = b.lodging?.nightMax ?? b.lodging?.nightMin;
    if (lo !== undefined) p.nightMin = Math.min(p.nightMin ?? lo, lo);
    if (hi !== undefined) p.nightMax = Math.max(p.nightMax ?? hi, hi);
    by.set(code, p);
  }
  return [...by.values()]
    .filter((p) => !curation[p.provinceCode]?.hidden)
    .map((p) => ({ ...p, ...pick(curation[p.provinceCode]) }))
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || b.count - a.count || a.provinceCode.localeCompare(b.provinceCode));
}

const pick = (c: HolidayPlaceCuration | undefined) => ({
  ...(c?.season ? { season: c.season } : {}),
  ...(c?.note ? { note: c.note } : {}),
  ...(c?.rank !== undefined ? { rank: c.rank } : {}),
});
