import { describe, expect, it } from 'vitest';

import { canPrepare, canPublish, invalidAssignmentModules, type Organization, type OrganizationMember } from '../index';

const org: Organization = {
  id: 'nilufer',
  name: 'Nilüfer Belediyesi',
  kind: 'ilce-belediyesi',
  scope: { level: 'ilce', provinceCode: '16', districtId: '16-nilufer' },
  modules: ['gonderiler', 'etkinlikler', 'bildirimler'],
  officialEmail: 'bilgi@nilufer.bel.tr',
  status: 'aktif',
  createdBy: 'admin',
  createdAt: '2026-01-01T00:00:00Z',
};
const member = (assignments: OrganizationMember['assignments'], over: Partial<OrganizationMember> = {}): OrganizationMember => ({
  orgId: 'nilufer',
  email: 'personel@nilufer.bel.tr',
  displayName: 'Personel',
  isOrgAdmin: false,
  assignments,
  ...over,
});

describe('kurum içi personel', () => {
  const now = new Date('2026-10-27T00:00:00Z');
  const basin = member({ gonderiler: { role: 'hazirlayan' } });
  const ozelKalem = member({ gonderiler: { role: 'onaylayan' } });
  const fenIsleri = member({ bildirimler: { role: 'hazirlayan', canPublishDirectly: true } });

  it('basın müdürü hazırlar ama yayınlayamaz; özel kalem yayınlar', () => {
    expect(canPrepare(org, basin, 'gonderiler', now)).toBe(true);
    expect(canPublish(org, basin, 'gonderiler', now)).toBe(false);
    expect(canPublish(org, ozelKalem, 'gonderiler', now)).toBe(true);
  });

  it('"onaysız yayınlayabilir" yetkisi olan hazırlayan doğrudan yayınlar', () => {
    expect(canPublish(org, fenIsleri, 'bildirimler', now)).toBe(true);
    expect(canPublish(org, fenIsleri, 'gonderiler', now)).toBe(false);
  });

  it('ayrılan ya da süresi dolan personel hiçbir şey yapamaz', () => {
    expect(canPrepare(org, member({ gonderiler: { role: 'hazirlayan' } }, { removedAt: '2026-10-01T00:00:00Z' }), 'gonderiler', now)).toBe(false);
    expect(canPublish(org, member({ gonderiler: { role: 'onaylayan' } }, { expiresAt: '2026-10-01T00:00:00Z' }), 'gonderiler', now)).toBe(false);
  });

  it('kuruma verilmemiş bölümde görev verilemez', () => {
    expect(invalidAssignmentModules(org, { gonderiler: { role: 'hazirlayan' }, yetkiler: { role: 'onaylayan' } })).toEqual(['yetkiler']);
    expect(canPrepare(org, member({ yetkiler: { role: 'hazirlayan' } }), 'yetkiler', now)).toBe(false);
  });
});
