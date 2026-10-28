import { isMemberActive, isOrganizationActive } from '../organizations/staff';
import type { Organization, OrganizationMember } from '../organizations/types';
import { scopeKey } from '../permissions/grants';
import { isGrantActive } from '../permissions/can';
import type { Action, Module, PermissionGrant, RegionScope } from '../permissions/types';

/**
 * Resmî duyurular (PROJE.md 6.2 madde 1, 4, 6; 6.6): kurum (belediye, kurum), muhtar ve il yöneticisi yayınlar.
 * Hazırlayan taslak yazar ve onaya gönderir; "Onayla" yetkisi olan onaylar; "Onaysız yayınla" yetkisi olan
 * doğrudan yayınlar. Muhtarın onaya giden duyurusu il yöneticisine gider (PROJE.md 6.7). Acil duyuru il / admin
 * onayına girmez (6.5), en üstte sabit görünür ve bitiş tarihiyle kendiliğinden kalkar.
 */

/**
 * "haber": kurum haberi (PROJE.md 5.3 Haberler, birinci kaynak resmî kurumlar). Duyurudan farkı: kategorisi vardır,
 * Sosyal Harmoni > Haberler'de ve Keşfet akışında görünür; duyuru listelerinde (ana sayfa, Tüm duyurular, Mahalle
 * Meydanı) görünmez. Onay akışı duyuruyla aynıdır.
 */
export const ANNOUNCEMENT_KINDS = ['duyuru', 'haber', 'acil'] as const;
export type AnnouncementKind = (typeof ANNOUNCEMENT_KINDS)[number];

export const NEWS_CATEGORIES = ['gundem', 'hizmet', 'ulasim', 'kultur-sanat', 'spor', 'egitim', 'saglik', 'cevre', 'ekonomi'] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

/** Duyuru listelerinde görünür mü (haberler Haberler sayfasında). */
export const isNotice = (a: Pick<Announcement, 'kind'>) => a.kind !== 'haber';

/** Okuma süresi (dakika, en az 1): dakikada yaklaşık 200 sözcük. */
export const readingMinutes = (text: string) => Math.max(1, Math.round(text.trim().split(/\s+/).filter(Boolean).length / 200));

export type AnnouncementStatus = 'taslak' | 'onay-bekliyor' | 'reddedildi' | 'yayinda' | 'kaldirildi';

/** Yayınlayan: kurum (adıyla) ya da kişi yetkisi (rolü ve yetkinin bölgesiyle; ad uygulamada bölgeden yazılır). */
export type AnnouncementAuthor =
  | { type: 'kurum'; orgId: string; name: string }
  | { type: 'kisi'; role: 'muhtar' | 'il-yoneticisi'; grantKey: string };

export interface AnnouncementRegion {
  provinceCode: string;
  districtId?: string;
  neighbourhoodId?: string;
}

export interface AnnouncementInput {
  kind: AnnouncementKind;
  title: string;
  body: string;
  /** Hedef bölge; yayınlayanın bölgesinin içinde olmalı. */
  region: AnnouncementRegion;
  /** Bu tarihten sonra gösterilmez (ISO). Acil duyuruda zorunlu. */
  endsAt?: string;
  /**
   * Mahalle Meydanı'nda ve listede sabit (acil duyurulardan sonra en üstte). Yalnızca mahalleye yönelik duyuruda:
   * muhtarın "pazar günü", "muhtarlık saatleri" gibi kalıcı bilgisi için.
   */
  pinned?: boolean;
  /** Yalnızca haberde, zorunlu. */
  category?: NewsCategory;
}

export interface Announcement extends AnnouncementInput {
  id: string;
  author: AnnouncementAuthor;
  status: AnnouncementStatus;
  /** Hazırlayan kişi (ad yalnızca panelde, kurum içi kayıt için). */
  preparedBy: string;
  preparedByName: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  reviewedBy?: string;
  /** Ret gerekçesi (zorunlu). */
  reviewNote?: string;
}

export const ANNOUNCEMENT_LIMITS = { title: [3, 100], body: [10, 2000], reviewNote: [5, 300] } as const;
/** Acil duyuru en çok bu kadar gün açık kalır (unutulup sürekli en üstte kalmasın). */
export const URGENT_MAX_DAYS = 7;

export type AnnouncementError = 'title' | 'body' | 'region' | 'endsAt' | 'pinned' | 'category';

/** Bölge, yetki bölgesinin içinde mi (il > ilçe > mahalle)? */
export function regionWithin(r: AnnouncementRegion, scope: RegionScope): boolean {
  if (scope.level === 'ulke') return true;
  if (r.provinceCode !== scope.provinceCode) return false;
  if (scope.level === 'il') return true;
  if (r.districtId !== scope.districtId) return false;
  return scope.level === 'ilce' || r.neighbourhoodId === scope.neighbourhoodId;
}

export function validateAnnouncement(a: AnnouncementInput, scope: RegionScope, now = new Date()): AnnouncementError[] {
  const errors: AnnouncementError[] = [];
  const len = (s: string) => s.trim().length;
  const [tMin, tMax] = ANNOUNCEMENT_LIMITS.title;
  const [bMin, bMax] = ANNOUNCEMENT_LIMITS.body;
  if (len(a.title) < tMin || len(a.title) > tMax) errors.push('title');
  if (len(a.body) < bMin || len(a.body) > bMax) errors.push('body');
  const r = a.region;
  const shapeOk = /^[0-8][0-9]$/.test(r.provinceCode) && (!r.neighbourhoodId || !!r.districtId);
  if (!shapeOk || !regionWithin(r, scope)) errors.push('region');
  if (a.endsAt) {
    const end = new Date(a.endsAt).getTime();
    const max = now.getTime() + URGENT_MAX_DAYS * 86400000;
    if (!(end > now.getTime()) || (a.kind === 'acil' && end > max)) errors.push('endsAt');
  } else if (a.kind === 'acil') errors.push('endsAt');
  // Sabitleme yalnızca mahalleye yönelik, acil olmayan duyuruda.
  if (a.pinned && (!r.neighbourhoodId || a.kind !== 'duyuru')) errors.push('pinned');
  // Kategori yalnızca haberde ve orada zorunlu.
  if (a.kind === 'haber' ? !a.category || !NEWS_CATEGORIES.includes(a.category) : !!a.category) errors.push('category');
  return errors;
}

/** Yayında ve süresi geçmemiş mi? */
export function isAnnouncementLive(a: Pick<Announcement, 'status' | 'endsAt'>, now = new Date()): boolean {
  return a.status === 'yayinda' && (!a.endsAt || new Date(a.endsAt) > now);
}

/** Kullanıcının konumuna yönelik mi: il geneli, kendi ilçesi ya da kendi mahallesi. */
export function isForLocation(a: Pick<Announcement, 'region'>, loc: AnnouncementRegion): boolean {
  const r = a.region;
  return r.provinceCode === loc.provinceCode && (!r.districtId || r.districtId === loc.districtId) && (!r.neighbourhoodId || r.neighbourhoodId === loc.neighbourhoodId);
}

/** Akış: yayındaki acil duyurular en üstte (PROJE.md 5.5), sonra sabitlenenler, sonra yeniden eskiye. */
export function sortForFeed<T extends Pick<Announcement, 'kind' | 'publishedAt' | 'pinned'>>(list: T[]): T[] {
  return [...list].sort(
    (a, b) =>
      Number(b.kind === 'acil') - Number(a.kind === 'acil') ||
      Number(!!b.pinned) - Number(!!a.pinned) ||
      (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
  );
}

/** Panelde "hangi hesapla yayınlıyorum?": kişinin duyuru yazabildiği her kurum ve yetki. */
export interface Publisher {
  /** Seçim anahtarı: kurum kimliği ya da yetki anahtarı. */
  key: string;
  author: AnnouncementAuthor;
  scope: RegionScope;
  /** Bu hesapta işaretli eylemler (ekle, onayla, yayinla, sil...). */
  actions: Action[];
}

export const canPublishDirectly = (p: Pick<Publisher, 'actions'>) => p.actions.includes('yayinla') || p.actions.includes('onayla');

/** Kişinin bir içerik bölümünde (duyurular: gonderiler, etkinlikler) yazabildiği her kurum ve yetki. */
export function publishersFor(
  grants: readonly PermissionGrant[],
  memberships: readonly { org: Organization; member: OrganizationMember }[],
  now = new Date(),
  module: Extract<Module, 'gonderiler' | 'etkinlikler'> = 'gonderiler',
): Publisher[] {
  const out: Publisher[] = [];
  for (const { org, member } of memberships) {
    if (!isOrganizationActive(org, now) || !isMemberActive(member, now) || !org.modules.includes(module)) continue;
    const actions = member.assignments[module] ?? [];
    if (actions.includes('ekle') || actions.includes('onayla')) {
      out.push({ key: org.id, author: { type: 'kurum', orgId: org.id, name: org.name }, scope: org.scope, actions });
    }
  }
  for (const g of grants) {
    if (g.orgId || (g.role !== 'muhtar' && g.role !== 'il-yoneticisi') || !isGrantActive(g, now)) continue;
    const actions = g.modules[module] ?? [];
    if (actions.includes('ekle')) {
      const key = scopeKey(g.scope);
      out.push({ key, author: { type: 'kisi', role: g.role, grantKey: key }, scope: g.scope, actions });
    }
  }
  return out;
}

/** Bir yayınlayan hesabın içeriği mi? */
export function isFromPublisher(a: Pick<Announcement, 'author'>, p: Publisher): boolean {
  return a.author.type === 'kurum' ? p.author.type === 'kurum' && a.author.orgId === p.author.orgId : p.author.type === 'kisi' && a.author.grantKey === p.author.grantKey;
}
