import type { Action, Module, PermissionGrant, RegionRef, RegionScope } from './types';

/** Yetki bölgesi, işlemin yapıldığı yeri kapsıyor mu? */
export function scopeCovers(scope: RegionScope, region: RegionRef): boolean {
  switch (scope.level) {
    case 'ulke':
      return true;
    case 'il':
      return region.provinceCode === scope.provinceCode;
    case 'ilce':
      return region.districtId === scope.districtId;
    case 'mahalle':
      return region.neighbourhoodId === scope.neighbourhoodId;
  }
}

export function isGrantActive(grant: PermissionGrant, now: Date): boolean {
  if (grant.revokedAt) return false;
  return !grant.expiresAt || new Date(grant.expiresAt) > now;
}

export interface PermissionCheck {
  module: Module;
  action: Action;
  /** Boş bırakılırsa işlem bölgesizdir ve yalnızca ülke kapsamlı yetki geçerlidir. */
  region?: RegionRef;
}

/**
 * Rol × bölge × modül × eylem kontrolü. Panelde menüyü süzmek için de kullanılır, ama asıl kontrol
 * sunucuda (veritabanı kuralları ve sunucu işlevleri) aynı mantıkla tekrar yapılır.
 */
export function can(grants: readonly PermissionGrant[], check: PermissionCheck, now = new Date()): boolean {
  return grants.some(
    (g) =>
      isGrantActive(g, now) &&
      (g.modules[check.module] ?? []).includes(check.action) &&
      (check.region ? scopeCovers(g.scope, check.region) : g.scope.level === 'ulke'),
  );
}

/** Bir modülde herhangi bir bölgede görüntüleme yetkisi var mı (menüde göstermek için). */
export function canSeeModule(grants: readonly PermissionGrant[], module: Module, now = new Date()): boolean {
  return grants.some((g) => isGrantActive(g, now) && (g.modules[module] ?? []).includes('goruntule'));
}
