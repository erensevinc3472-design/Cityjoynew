/**
 * Resmî hesap kitlesi (PROJE.md 6.1, Karar Eren 3 Kasım 2026): belediye, kurum, muhtarlık ve belediye başkanı
 * profillerini takip edenlerin isimsiz, toplu istatistiği. Takipçinin kayıtlı konumu (GPS değil) ve doğum yılından
 * gelen yaş aralığı sayılır; kimlik hiçbir zaman panele gitmez. 10 kişiden küçük gruplar ayrı gösterilmez,
 * "Diğer"e katılır. Sayım takip anından başlar, geriye dönük değildir.
 *
 * Sayaçlar `officialStats/{profileId}` belgesinde durur: takip kaydı ile sayaç aynı toplu yazımda değişir ve
 * kurallar her sayacın kişinin kayıtlı konumuna ve yaşına göre tam bir değiştiğini denetler.
 */

import type { UserProfile } from '../models/user';

/** Yaş aralıkları (Instagram'daki gibi). 18 yaş altı ayrı tutulur ama panelde gösterilmez. */
export const AGE_BANDS = ['18-24', '25-34', '35-44', '45-54', '55+'] as const;
export type AgeBand = (typeof AGE_BANDS)[number] | 'u18';

/** Bu sayıdan az kişilik grup ayrı gösterilmez (KVKK, kişinin tanınmaması için). */
export const AUDIENCE_MIN_GROUP = 10;

export function ageBandOf(birthYear: number, year = new Date().getUTCFullYear()): AgeBand {
  const age = year - birthYear;
  if (age < 18) return 'u18';
  if (age < 25) return '18-24';
  if (age < 35) return '25-34';
  if (age < 45) return '35-44';
  if (age < 55) return '45-54';
  return '55+';
}

/** Takip kaydında tutulan, sayılan bilgiler. Konum girilmemişse alanlar null. */
export interface AudienceKeys {
  provinceCode: string | null;
  districtId: string | null;
  neighbourhoodId: string | null;
  ageBand: AgeBand;
}

export function audienceKeysOf(p: Pick<UserProfile, 'location' | 'birthYear'>, now = new Date()): AudienceKeys {
  return {
    provinceCode: p.location?.provinceCode ?? null,
    districtId: p.location?.districtId ?? null,
    neighbourhoodId: p.location?.neighbourhoodId ?? null,
    ageBand: ageBandOf(p.birthYear, now.getUTCFullYear()),
  };
}

export const sameAudienceKeys = (a: AudienceKeys, b: AudienceKeys) =>
  a.provinceCode === b.provinceCode && a.districtId === b.districtId && a.neighbourhoodId === b.neighbourhoodId && a.ageBand === b.ageBand;

/** Günlük sayaç anahtarı (UTC, kurallardaki request.time ile aynı): "20261103". */
export function dayKey(d = new Date()): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Belediye başkanının profili: belediyenin kimliğine bağlı ("baskan-bld-16-osmangazi"). */
export const mayorProfileId = (orgId: string) => `baskan-${orgId}`;
export const isMunicipalityId = (id: string) => id.startsWith('bld-');

/** Sayaç belgesi. Haritalarda anahtar il kodu / ilçe / mahalle kimliği / yaş aralığı / gün. */
export interface OfficialStats {
  /** Şu anki takipçi. */
  total: number;
  /** Takipten çıkma (toplam). */
  unfollows: number;
  p: Record<string, number>;
  d: Record<string, number>;
  n: Record<string, number>;
  a: Partial<Record<AgeBand, number>>;
  /** Gün başına yeni takip ve takipten çıkma. */
  f: Record<string, number>;
  u: Record<string, number>;
}

export const EMPTY_STATS: OfficialStats = { total: 0, unfollows: 0, p: {}, d: {}, n: {}, a: {}, f: {}, u: {} };

export interface AudienceRow {
  /** Kimlik (il kodu, ilçe, mahalle, yaş aralığı); "Diğer" satırında boş. */
  key: string;
  value: number;
}

/**
 * Büyükten küçüğe sıralar, en çok `top` satır ve 10 kişiden küçük grupları "Diğer"e katar. Diğer de 10'dan küçükse
 * ayrı gösterilmez (yalnızca toplamın içinde kalır), böylece tek bir küçük grup farktan bulunamaz.
 */
export function foldSmall(counts: Record<string, number>, top = Infinity, min = AUDIENCE_MIN_GROUP): { rows: AudienceRow[]; other: number | null } {
  const sorted = Object.entries(counts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const rows: AudienceRow[] = [];
  let rest = 0;
  for (const [key, value] of sorted) {
    if (value >= min && rows.length < top) rows.push({ key, value });
    else rest += value;
  }
  return { rows, other: rest >= min ? rest : null };
}

/** Bir öneki taşıyan anahtarlar (ilin ilçeleri "16-", ilçenin mahalleleri "16-nilufer-"). */
export function within(counts: Record<string, number>, prefix: string): Record<string, number> {
  return Object.fromEntries(Object.entries(counts).filter(([k]) => k.startsWith(prefix)));
}

const sum = (counts: Record<string, number>) => Object.values(counts).reduce((s, v) => s + Math.max(0, v), 0);

/** Kurumun ilindeki ve il dışındaki takipçi; konum girmeyenler ayrı. Kurum ülke genelindeyse il yok. */
export function homeSplit(s: OfficialStats, provinceCode: string | undefined) {
  const located = sum(s.p);
  const inside = provinceCode ? Math.max(0, s.p[provinceCode] ?? 0) : 0;
  return { inside, outside: provinceCode ? located - inside : located, unknown: Math.max(0, s.total - located) };
}

/** Son n günün yeni takip, takipten çıkma ve net değişimi. */
export function periodChange(s: OfficialStats, days: number, now = new Date()) {
  let follows = 0;
  let unfollows = 0;
  for (let i = 0; i < days; i++) {
    const k = dayKey(new Date(now.getTime() - i * 86400000));
    follows += s.f[k] ?? 0;
    unfollows += s.u[k] ?? 0;
  }
  return { follows, unfollows, net: follows - unfollows };
}

/** Haftalık net takipçi değişimi (en eskisi başta), her hafta 7 gün. */
export function weeklyNet(s: OfficialStats, weeks: number, now = new Date()): { start: Date; follows: number; unfollows: number }[] {
  return Array.from({ length: weeks }, (_, w) => {
    const end = new Date(now.getTime() - (weeks - 1 - w) * 7 * 86400000);
    let follows = 0;
    let unfollows = 0;
    for (let i = 0; i < 7; i++) {
      const k = dayKey(new Date(end.getTime() - i * 86400000));
      follows += s.f[k] ?? 0;
      unfollows += s.u[k] ?? 0;
    }
    return { start: new Date(end.getTime() - 6 * 86400000), follows, unfollows };
  });
}
