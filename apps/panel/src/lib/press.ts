import type { Action, Module, Publisher, RegionScope } from '@cityjoy/shared';

import { isAdminUser, type PanelUser } from './session';

/** Şablon ve yerel gün kaydının işlem kaydı bölümü (kural buna göre izin verir). */
export function pressAuditAs(user: PanelUser, p: Publisher): { module: Extract<Module, 'kurumlar' | 'gonderiler'>; action: Action; orgId?: string; scope?: RegionScope } {
  if (p.author.type === 'kurum') {
    const orgAdmin = user.memberships.some((m) => m.org.id === p.key && m.member.isOrgAdmin);
    return orgAdmin || isAdminUser(user) ? { module: 'kurumlar', action: 'duzenle', orgId: p.key } : { module: 'gonderiler', action: 'ekle', orgId: p.key };
  }
  return { module: 'gonderiler', action: 'ekle', scope: p.scope };
}

/** Şablonları düzenleyebilir mi: kurum yöneticisi ya da bu hesapta duyuru ekleyebilen. */
export const canEditTemplates = (user: PanelUser, p: Publisher) =>
  !user.isDemo && (p.actions.includes('ekle') || user.memberships.some((m) => m.org.id === p.key && m.member.isOrgAdmin));
