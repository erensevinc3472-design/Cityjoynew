/**
 * Admin bildirimleri (PROJE.md 7; Karar Eren 5 Kasım 2026): CityJoy admini panelden her türlü bildirimi gönderir
 * (duyuru, etkinlik, kampanya / tanıtım, işletme reklamı). İşletme reklamı ücret karşılığı yapılır; ödeme ilk sürümde
 * uygulama dışında, ücret ve fatura panelde elle (yalnızca admin görür). Haftalık / gece sınırı yok (Eren: admin elle
 * girer). Kampanya ve reklam yalnızca kampanya iznini veren 18 yaş ve üstüne gider (ticari ileti kuralı) ve "Reklam" /
 * "Kampanya" diye etiketlenir. Hedef: ülke, il, ilçe ya da mahalle; yaş / cinsiyet / meslek (ayrı izin aranmaz).
 */

import type { UserLocation } from '../locations/types';
import type { UserProfile } from '../models/user';
import { isEmptyTarget, matchesPushTarget, type AudienceFilter } from '../announcements/push-target';

export const ADMIN_PUSH_KINDS = ['duyuru', 'etkinlik', 'kampanya', 'reklam'] as const;
export type AdminPushKind = (typeof ADMIN_PUSH_KINDS)[number];

/** Kampanya ve reklam ticari iletidir: izin ve yaş şartı. */
export const isCommercial = (k: AdminPushKind) => k === 'kampanya' || k === 'reklam';

/** Bildirime dokununca açılacak yer. */
export type AdminPushLink =
  | { type: 'yok' }
  | { type: 'isletme'; id: string }
  | { type: 'etkinlik'; id: string }
  | { type: 'duyuru'; id: string }
  /** İşletmenin kendi sayfasında paylaştığı resimli / videolu gönderi (Karar Eren 5 Kasım 2026). */
  | { type: 'gonderi'; id: string };

export interface AdminPushRegion {
  /** Boşsa ülke geneli. */
  provinceCode?: string;
  districtId?: string;
  neighbourhoodId?: string;
}

export type AdminPushStatus = 'planli' | 'gonderildi' | 'iptal';

export interface AdminPush {
  id: string;
  kind: AdminPushKind;
  title: string;
  body: string;
  region: AdminPushRegion;
  /** Sorgu için: il kodu ya da ülke geneli "TR". */
  scope: string;
  target?: AudienceFilter;
  link: AdminPushLink;
  /** Reklamda işletme (bildirimde "Reklam · {ad}"). */
  business?: { id: string; name: string };
  status: AdminPushStatus;
  /** Gönderim anı (ISO); geçmiş ya da şimdiyse hemen gider. */
  sendAt: string;
  createdBy: string;
  createdAt: string;
  sentAt?: string;
  /** Bildirimin gittiği kişi sayısı. */
  recipients?: number;
  /** Hedef 50 kişiden küçük çıktıysa gönderilmez. */
  skipped?: 'kucuk-grup';
}

export const ADMIN_PUSH_LIMITS = { title: [3, 65], body: [3, 240] } as const;

export type AdminPushError = 'title' | 'body' | 'business' | 'link' | 'sendAt';

export function validateAdminPush(p: Pick<AdminPush, 'kind' | 'title' | 'body' | 'business' | 'link' | 'sendAt'>, now = new Date()): AdminPushError[] {
  const errs: AdminPushError[] = [];
  const len = (s: string) => s.trim().length;
  if (len(p.title) < ADMIN_PUSH_LIMITS.title[0] || len(p.title) > ADMIN_PUSH_LIMITS.title[1]) errs.push('title');
  if (len(p.body) < ADMIN_PUSH_LIMITS.body[0] || len(p.body) > ADMIN_PUSH_LIMITS.body[1]) errs.push('body');
  if (p.kind === 'reklam' && !p.business?.id) errs.push('business');
  if (p.link.type !== 'yok' && !('id' in p.link && p.link.id)) errs.push('link');
  const at = new Date(p.sendAt).getTime();
  if (Number.isNaN(at) || at > now.getTime() + 60 * 86400000) errs.push('sendAt');
  return errs;
}

export const adminPushScope = (r: AdminPushRegion) => r.provinceCode || 'TR';

/** Bölge kişinin konumunu kapsıyor mu (ülke geneli herkesi). */
export function regionCovers(r: AdminPushRegion, loc?: Partial<UserLocation> | null): boolean {
  if (!r.provinceCode) return true;
  if (!loc || loc.provinceCode !== r.provinceCode) return false;
  if (r.districtId && loc.districtId !== r.districtId) return false;
  if (r.neighbourhoodId && loc.neighbourhoodId !== r.neighbourhoodId) return false;
  return true;
}

type Person = Pick<UserProfile, 'birthYear' | 'gender' | 'occupationId'> & {
  location?: Partial<UserLocation>;
  consents?: { commercialMessages?: { granted?: boolean } };
};

/** Bu kişi bu bildirimi almalı mı (sunucu gönderirken, uygulama bildirim kutusunda aynı kuralı kullanır). */
export function adminPushReaches(p: Person, push: Pick<AdminPush, 'kind' | 'region' | 'target'>, now = new Date()): boolean {
  if (!regionCovers(push.region, p.location)) return false;
  if (isCommercial(push.kind) && (p.consents?.commercialMessages?.granted !== true || now.getFullYear() - p.birthYear < 18)) return false;
  return isEmptyTarget(push.target) || matchesPushTarget(p, push.target, now);
}

/** Uygulamada açılacak ekran. */
export function adminPushHref(link: AdminPushLink): { pathname: string; params?: Record<string, string> } {
  switch (link.type) {
    case 'isletme':
      return { pathname: '/business/[id]', params: { id: link.id } };
    case 'etkinlik':
      return { pathname: '/events/[id]', params: { id: link.id } };
    case 'duyuru':
      return { pathname: '/announcements/[id]', params: { id: link.id } };
    case 'gonderi':
      return { pathname: '/explore/[id]', params: { id: link.id } };
    default:
      return { pathname: '/notifications' };
  }
}
