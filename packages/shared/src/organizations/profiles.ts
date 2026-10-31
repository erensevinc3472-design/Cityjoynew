import type { Photo } from '../media/photo';
import type { AnnouncementAuthor, AnnouncementRegion } from '../announcements/announcements';
import { isGrantActive } from '../permissions/can';
import { scopeKey } from '../permissions/grants';
import type { PermissionGrant, RegionScope } from '../permissions/types';
import { normalizeName } from './municipalities';
import { isMemberActive, isOrganizationActive } from './staff';
import type { Organization, OrganizationMember } from './types';

/**
 * Resmî profil (PROJE.md 6.2 madde 2): kurumun (belediye, kurum) ya da muhtarlığın herkese açık künyesi. Ad, bölge,
 * tanıtım, telefon, e-posta, web, adres, çalışma saatleri. Uygulamada "Resmî hesap" rozetiyle görünür; duyuru ve
 * etkinliklerde yayınlayanın adına dokununca açılır, Mahalle Meydanı muhtarı ve belediyeyi buradan gösterir.
 * Kimlik: kurumda kurum kimliği ("bld-16-nilufer"), muhtarlıkta mahalle yetki anahtarı ("mahalle-16-nilufer-ataevler").
 * Logo sonra (Storage, Blaze).
 */

export type OfficialProfileType = 'kurum' | 'muhtar';

export interface OfficialProfileInput {
  about?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  /** Serbest metin: "Hafta içi 08.30-17.30". */
  hours?: string;
  /** Logo (panelden yüklenir; Storage, Blaze). */
  logo?: Photo;
}

export interface OfficialProfile extends OfficialProfileInput {
  id: string;
  type: OfficialProfileType;
  /** Kurumda kurumun adı; muhtarlıkta muhtarın adı (isteğe bağlı, boşsa "X Mahallesi Muhtarlığı" yazılır). */
  name: string;
  /** Ülke geneli kurumda yok. */
  region?: AnnouncementRegion;
  updatedAt: string;
}

export const OFFICIAL_PROFILE_LIMITS = { about: 600, phone: [7, 20], email: 120, website: 200, address: 200, hours: 200, name: 80 } as const;

export type OfficialProfileError = 'about' | 'phone' | 'email' | 'website' | 'address' | 'hours' | 'name';

export const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{5,18}[0-9]$/;
export const EMAIL_PATTERN = /^[^@\sA-Z]+@[^@\sA-Z]+\.[^@\sA-Z]+$/;
export const HTTPS_PATTERN = /^https:\/\/[^\s]+\.[^\s]+$/;

export function validateOfficialProfile(p: OfficialProfileInput & { name?: string }, type: OfficialProfileType): OfficialProfileError[] {
  const errors: OfficialProfileError[] = [];
  const v = (s: string | undefined) => (s ?? '').trim();
  const L = OFFICIAL_PROFILE_LIMITS;
  if (type === 'muhtar' && v(p.name).length > L.name) errors.push('name');
  if (v(p.about).length > L.about) errors.push('about');
  if (v(p.phone) && !PHONE_PATTERN.test(v(p.phone))) errors.push('phone');
  if (v(p.email) && (!EMAIL_PATTERN.test(v(p.email)) || v(p.email).length > L.email)) errors.push('email');
  if (v(p.website) && (!HTTPS_PATTERN.test(v(p.website)) || v(p.website).length > L.website)) errors.push('website');
  if (v(p.address).length > L.address) errors.push('address');
  if (v(p.hours).length > L.hours) errors.push('hours');
  return errors;
}

export const muhtarProfileId = (neighbourhoodId: string) => `mahalle-${neighbourhoodId}`;

/** Duyuru / etkinlik yayınlayanının resmî profili (il yöneticisinin profili yok). */
export function profileIdOfAuthor(a: AnnouncementAuthor): string | null {
  if (a.type === 'kurum') return a.orgId;
  return a.role === 'muhtar' ? a.grantKey : null;
}

/**
 * Bir konumun belediyeleri: ilçe belediyesi (merkez ilçede il belediyesi) ve büyükşehir / il belediyesi.
 * Kimlikler kilitli ad listesindeki kimliklerdir (municipalities.ts).
 */
export function municipalityIdsFor(loc: { provinceCode: string; districtId?: string }): string[] {
  const out: string[] = [];
  if (loc.districtId && loc.districtId !== `${loc.provinceCode}-merkez`) out.push(`bld-${loc.districtId}`);
  out.push(`bld-${loc.provinceCode}`);
  return out;
}

/**
 * İki mahalle adı aynı yer mi? Konum listesinde "Ataevler Mahallesi", Excel'de "Ataevler" ya da "Ataevler Mah."
 * yazılabilir; büyük/küçük harf, Türkçe harf ve "mahallesi / mah. / köyü" eki fark etmez.
 */
export function sameNeighbourhoodName(a: string, b: string): boolean {
  const core = (s: string) => normalizeName(s).replace(/ (mahallesi|mahalle|mah|koyu|koy)$/, '').trim();
  return !!core(a) && core(a) === core(b);
}

/** Panelde düzenlenebilen profil: kurum yöneticisinin kurumu ya da muhtarın mahallesi. */
export interface ProfileTarget {
  id: string;
  type: OfficialProfileType;
  /** Kurumda kurumun adı (değişmez); muhtarlıkta boş. */
  name: string;
  region?: AnnouncementRegion;
  orgId?: string;
}

/** Yetki bölgesinin konum karşılığı (ülke geneli: yok). */
export function regionOfScope(scope: RegionScope): AnnouncementRegion | undefined {
  if (scope.level === 'ulke') return undefined;
  return {
    provinceCode: scope.provinceCode,
    ...(scope.level !== 'il' ? { districtId: scope.districtId } : {}),
    ...(scope.level === 'mahalle' ? { neighbourhoodId: scope.neighbourhoodId } : {}),
  };
}

/**
 * Kişinin düzenleyebildiği resmî profiller: kurum yöneticisi olduğu (çalışan) kurumlar ve geçerli muhtar yetkileri.
 * Admin kurumları ayrıca listeden seçer.
 */
export function profileTargetsFor(
  grants: readonly PermissionGrant[],
  memberships: readonly { org: Organization; member: OrganizationMember }[],
  now = new Date(),
): ProfileTarget[] {
  const out: ProfileTarget[] = [];
  for (const { org, member } of memberships) {
    if (!member.isOrgAdmin || !isMemberActive(member, now) || !isOrganizationActive(org, now)) continue;
    out.push(orgProfileTarget(org));
  }
  for (const g of grants) {
    if (g.orgId || g.role !== 'muhtar' || g.scope.level !== 'mahalle' || !isGrantActive(g, now)) continue;
    const id = scopeKey(g.scope);
    if (!out.some((x) => x.id === id)) out.push({ id, type: 'muhtar', name: '', region: regionOfScope(g.scope) });
  }
  return out;
}

export function orgProfileTarget(org: Organization): ProfileTarget {
  const region = regionOfScope(org.scope);
  return { id: org.id, type: 'kurum', name: org.name, ...(region ? { region } : {}), orgId: org.id };
}