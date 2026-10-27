import type { Module } from '../permissions/types';
import type { Organization, OrganizationMember, StaffRole } from './types';

function isActive(member: OrganizationMember, now: Date): boolean {
  if (member.removedAt) return false;
  return !member.expiresAt || new Date(member.expiresAt) > now;
}

function roleIn(org: Organization, member: OrganizationMember, module: Module, now: Date): StaffRole | undefined {
  if (!isActive(member, now) || member.orgId !== org.id || !org.modules.includes(module)) return undefined;
  return member.assignments[module]?.role;
}

/** Personel bu bölümde taslak hazırlayabilir mi? */
export function canPrepare(org: Organization, member: OrganizationMember, module: Module, now = new Date()): boolean {
  const role = roleIn(org, member, module, now);
  return role === 'hazirlayan' || role === 'onaylayan';
}

/** Onay beklemeden yayınlayabilir mi (onaylayan ya da "onaysız yayınlayabilir" yetkisi olan)? */
export function canPublish(org: Organization, member: OrganizationMember, module: Module, now = new Date()): boolean {
  const role = roleIn(org, member, module, now);
  if (role === 'onaylayan') return true;
  return role === 'hazirlayan' && !!member.assignments[module]?.canPublishDirectly;
}

/**
 * Kurum yöneticisi, kuruma verilmemiş bir bölümde görev veremez.
 * Döner: kurala uymayan bölümler (boşsa atama geçerlidir).
 */
export function invalidAssignmentModules(org: Organization, assignments: OrganizationMember['assignments']): Module[] {
  return (Object.keys(assignments) as Module[]).filter((m) => !org.modules.includes(m));
}
