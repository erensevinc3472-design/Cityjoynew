import { describe, expect, it } from 'vitest';

import { can, canSeeModule, ROLE_TEMPLATES, type PermissionGrant } from '../index';

const grant = (over: Partial<PermissionGrant>): PermissionGrant => ({
  id: 'g',
  email: 'u@ornek.com',
  role: 'belediye',
  scope: { level: 'ilce', provinceCode: '16', districtId: '16-nilufer' },
  modules: ROLE_TEMPLATES.belediye,
  grantedBy: 'admin',
  grantedAt: '2026-01-01T00:00:00Z',
  ...over,
});

describe('yetki', () => {
  const now = new Date('2026-10-27T00:00:00Z');

  it('ilçe belediyesi yalnızca kendi ilçesinde işlem yapar', () => {
    const g = [grant({})];
    const check = { module: 'gonderiler', action: 'ekle' } as const;
    expect(can(g, { ...check, region: { provinceCode: '16', districtId: '16-nilufer' } }, now)).toBe(true);
    expect(can(g, { ...check, region: { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' } }, now)).toBe(true);
    expect(can(g, { ...check, region: { provinceCode: '16', districtId: '16-osmangazi' } }, now)).toBe(false);
    expect(can(g, { ...check, region: { provinceCode: '16' } }, now)).toBe(false);
  });

  it('yetkisi olmayan eylem ve bölgesiz işlem reddedilir', () => {
    const g = [grant({})];
    expect(can(g, { module: 'yetkiler', action: 'ekle', region: { provinceCode: '16', districtId: '16-nilufer' } }, now)).toBe(false);
    expect(can(g, { module: 'gonderiler', action: 'ekle' }, now)).toBe(false);
  });

  it('admin her yerde, bölgesiz işlemlerde de yetkilidir', () => {
    const g = [grant({ role: 'admin', scope: { level: 'ulke' }, modules: ROLE_TEMPLATES.admin })];
    expect(can(g, { module: 'yetkiler', action: 'ekle' }, now)).toBe(true);
    expect(can(g, { module: 'konumlar', action: 'duzenle', region: { provinceCode: '34' } }, now)).toBe(true);
  });

  it('süresi dolan ya da geri alınan yetki geçersizdir', () => {
    expect(can([grant({ expiresAt: '2026-10-01T00:00:00Z' })], { module: 'gonderiler', action: 'ekle', region: { districtId: '16-nilufer' } }, now)).toBe(false);
    expect(canSeeModule([grant({ revokedAt: '2026-10-01T00:00:00Z' })], 'gonderiler', now)).toBe(false);
    expect(canSeeModule([grant({})], 'gonderiler', now)).toBe(true);
    expect(canSeeModule([grant({})], 'yetkiler', now)).toBe(false);
  });
});
