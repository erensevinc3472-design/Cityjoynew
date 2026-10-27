import { describe, expect, it } from 'vitest';

import { canApprove, canPrepare, canPublish, invalidAssignmentModules, normalizeAssignment, type Organization, type OrganizationMember } from '../index';

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
  const basin = member({ gonderiler: ['goruntule', 'ekle', 'duzenle'] });
  const ozelKalem = member({ gonderiler: ['goruntule', 'ekle', 'duzenle', 'onayla'] });
  const fenIsleri = member({ bildirimler: ['goruntule', 'ekle', 'yayinla'] });

  it('basın müdürü hazırlar ama yayınlayamaz; özel kalem yayınlar', () => {
    expect(canPrepare(org, basin, 'gonderiler', now)).toBe(true);
    expect(canPublish(org, basin, 'gonderiler', now)).toBe(false);
    expect(canPublish(org, ozelKalem, 'gonderiler', now)).toBe(true);
    expect(canApprove(org, ozelKalem, 'gonderiler', now)).toBe(true);
    expect(canApprove(org, basin, 'gonderiler', now)).toBe(false);
  });

  it('"onaysız yayınlayabilir" yetkisi olan hazırlayan doğrudan yayınlar', () => {
    expect(canPublish(org, fenIsleri, 'bildirimler', now)).toBe(true);
    expect(canPublish(org, fenIsleri, 'gonderiler', now)).toBe(false);
    // Onaysız yayınlayan, başkasının hazırladığını onaylayamaz.
    expect(canApprove(org, fenIsleri, 'bildirimler', now)).toBe(false);
  });

  it('görev kutucuklarla seçilir; eski kalıp biçimi de okunur', () => {
    expect(normalizeAssignment('gonderiler', ['yayinla', 'ekle', 'bildirim-gonder', 'uydurma'])).toEqual(['goruntule', 'ekle', 'yayinla']);
    expect(normalizeAssignment('bildirimler', ['bildirim-gonder'])).toEqual(['goruntule', 'bildirim-gonder']);
    expect(normalizeAssignment('gonderiler', { role: 'hazirlayan', canPublishDirectly: true })).toEqual(['goruntule', 'ekle', 'duzenle', 'yayinla']);
    expect(normalizeAssignment('gonderiler', { role: 'onaylayan' })).toEqual(['goruntule', 'ekle', 'duzenle', 'sil', 'onayla']);
    expect(normalizeAssignment('gonderiler', [])).toEqual([]);
  });

  it('ayrılan ya da süresi dolan personel hiçbir şey yapamaz', () => {
    expect(canPrepare(org, member({ gonderiler: ['goruntule', 'ekle'] }, { removedAt: '2026-10-01T00:00:00Z' }), 'gonderiler', now)).toBe(false);
    expect(canPublish(org, member({ gonderiler: ['goruntule', 'onayla'] }, { expiresAt: '2026-10-01T00:00:00Z' }), 'gonderiler', now)).toBe(false);
  });

  it('kuruma verilmemiş bölümde görev verilemez', () => {
    expect(invalidAssignmentModules(org, { gonderiler: ['goruntule'], yetkiler: ['goruntule', 'onayla'] })).toEqual(['yetkiler']);
    expect(canPrepare(org, member({ yetkiler: ['goruntule', 'ekle'] }), 'yetkiler', now)).toBe(false);
  });
});
