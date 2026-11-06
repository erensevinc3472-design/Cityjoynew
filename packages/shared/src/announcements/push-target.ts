/**
 * Hedefli bildirim (PROJE.md 7, 6.2 madde 12; Karar Eren 5 Kasım 2026: filtre yalnızca telefon bildirimini daraltır,
 * duyuru bölgedeki herkese uygulamada açık kalır). Bölge duyurunun bölgesidir; ek olarak yaş aralığı, cinsiyet ve meslek
 * seçilebilir. Karar (Eren, 5 Kasım 2026): ayrı izin aranmaz, bildirime izin veren herkes sayılır (aydınlatma metninde
 * yazılı; avukat teyidi). Belediye kişileri görmez,
 * yalnızca yaklaşık sayıyı görür; 50 kişiden küçük gruba gönderilmez. Acil duyuruda hedefleme yoktur (herkese gider).
 */

import type { Gender, UserProfile } from '../models/user';

export interface AudienceFilter {
  ageMin?: number;
  ageMax?: number;
  genders?: Exclude<Gender, 'belirtmek-istemiyorum'>[];
  occupations?: string[];
}

/** Bir kişinin tanınmaması için en küçük hedef grup. */
export const PUSH_TARGET_MIN_GROUP = 50;
export const PUSH_TARGET_LIMITS = { ageMin: 13, ageMax: 120, occupations: 10 } as const;

export const isEmptyTarget = (t?: AudienceFilter | null) =>
  !t || (t.ageMin === undefined && t.ageMax === undefined && !t.genders?.length && !t.occupations?.length);

export type PushTargetError = 'age' | 'occupations';

export function validatePushTarget(t: AudienceFilter): PushTargetError[] {
  const errs: PushTargetError[] = [];
  const okAge = (n?: number) => n === undefined || (Number.isInteger(n) && n >= PUSH_TARGET_LIMITS.ageMin && n <= PUSH_TARGET_LIMITS.ageMax);
  if (!okAge(t.ageMin) || !okAge(t.ageMax) || (t.ageMin !== undefined && t.ageMax !== undefined && t.ageMin > t.ageMax)) errs.push('age');
  if ((t.occupations?.length ?? 0) > PUSH_TARGET_LIMITS.occupations) errs.push('occupations');
  return errs;
}

/** Kaydetmeden önce boş alanları ayıklar; hepsi boşsa null (herkese). */
export function cleanPushTarget(t?: AudienceFilter | null): AudienceFilter | null {
  if (isEmptyTarget(t)) return null;
  return {
    ...(t!.ageMin !== undefined ? { ageMin: t!.ageMin } : {}),
    ...(t!.ageMax !== undefined ? { ageMax: t!.ageMax } : {}),
    ...(t!.genders?.length ? { genders: [...new Set(t!.genders)] } : {}),
    ...(t!.occupations?.length ? { occupations: [...new Set(t!.occupations)].slice(0, PUSH_TARGET_LIMITS.occupations) } : {}),
  };
}

type Person = Pick<UserProfile, 'birthYear' | 'gender' | 'occupationId'>;

/**
 * Kişi hedefe uyuyor mu? Hedef boşsa herkes uyar. Hedef varsa seçilen her filtreye uyan kişi (cinsiyet / meslek
 * belirtmeyen, o filtre seçildiyse dışarıda kalır).
 */
export function matchesPushTarget(p: Person, t: AudienceFilter | null | undefined, now = new Date()): boolean {
  if (isEmptyTarget(t)) return true;
  const age = now.getFullYear() - p.birthYear;
  if (t!.ageMin !== undefined && !(age >= t!.ageMin)) return false;
  if (t!.ageMax !== undefined && !(age <= t!.ageMax)) return false;
  if (t!.genders?.length && !(p.gender && (t!.genders as string[]).includes(p.gender))) return false;
  if (t!.occupations?.length && !(p.occupationId && t!.occupations.includes(p.occupationId))) return false;
  return true;
}

/** Panelde gösterilecek yaklaşık sayı: 50'den azsa "az", değilse 10'a yuvarlanmış (tek kişi seçilemesin). */
export function roundAudience(n: number): { tooSmall: boolean; approx: number } {
  return n < PUSH_TARGET_MIN_GROUP ? { tooSmall: true, approx: 0 } : { tooSmall: false, approx: Math.round(n / 10) * 10 };
}
