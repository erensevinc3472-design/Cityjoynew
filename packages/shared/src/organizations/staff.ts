import { STAFF_ACTIONS } from '../permissions/grants';
import type { Action, Module } from '../permissions/types';
import type { Organization, OrganizationMember, StaffAssignment } from './types';

export function isMemberActive(member: OrganizationMember, now = new Date()): boolean {
  if (member.removedAt) return false;
  return !member.expiresAt || new Date(member.expiresAt) > now;
}

/** Kurum çalışıyor mu (pasifleştirilmemiş, sözleşmesi bitmemiş)? */
export function isOrganizationActive(org: Organization, now = new Date()): boolean {
  return org.status === 'aktif' && (!org.contractEndsAt || new Date(org.contractEndsAt) > now);
}

function actionsIn(org: Organization, member: OrganizationMember, module: Module, now: Date): Action[] {
  if (!isMemberActive(member, now) || !isOrganizationActive(org, now) || member.orgId !== org.id || !org.modules.includes(module)) return [];
  return member.assignments[module] ?? [];
}

/** Personel bu bölümde taslak hazırlayabilir mi? */
export function canPrepare(org: Organization, member: OrganizationMember, module: Module, now = new Date()): boolean {
  return actionsIn(org, member, module, now).includes('ekle');
}

/** Başkasının hazırladığını onaylayıp yayınlayabilir mi? */
export function canApprove(org: Organization, member: OrganizationMember, module: Module, now = new Date()): boolean {
  return actionsIn(org, member, module, now).includes('onayla');
}

/** Kendi hazırladığını onay beklemeden yayınlayabilir mi ("onaysız yayınla" ya da onaylama yetkisi)? */
export function canPublish(org: Organization, member: OrganizationMember, module: Module, now = new Date()): boolean {
  const a = actionsIn(org, member, module, now);
  return a.includes('yayinla') || a.includes('onayla');
}

/**
 * Kurum yöneticisi, kuruma verilmemiş bir bölümde görev veremez.
 * Döner: kurala uymayan bölümler (boşsa atama geçerlidir).
 */
export function invalidAssignmentModules(org: Organization, assignments: OrganizationMember['assignments']): Module[] {
  return (Object.keys(assignments) as Module[]).filter((m) => !org.modules.includes(m));
}

/** Eski görev biçimi (27 Ekim 2026 öncesi): hazır kalıp + "onaysız yayınlayabilir" işareti. */
const LEGACY: Record<string, Action[]> = {
  izleyen: ['goruntule'],
  hazirlayan: ['goruntule', 'ekle', 'duzenle'],
  onaylayan: ['goruntule', 'ekle', 'duzenle', 'sil', 'onayla', 'bildirim-gonder'],
};

/**
 * Veritabanından gelen görevi işaretli eylem listesine çevirir: eski biçimi de okur, bilinmeyen eylemleri atar,
 * sabit sıraya dizer ve başka eylem varsa görüntülemeyi ekler.
 */
export function normalizeAssignment(module: Module, raw: unknown): StaffAssignment {
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (raw && typeof raw === 'object' && 'role' in raw) {
    const r = raw as { role: string; canPublishDirectly?: boolean };
    list = [...(LEGACY[r.role] ?? []), ...(r.canPublishDirectly ? ['yayinla'] : [])];
  }
  const allowed = STAFF_ACTIONS.filter((a) => module === 'bildirimler' || a !== 'bildirim-gonder');
  const out = allowed.filter((a) => list.includes(a));
  if (out.length && !out.includes('goruntule')) out.unshift('goruntule');
  return out;
}
