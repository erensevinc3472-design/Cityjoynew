import { describe, expect, it } from 'vitest';

import {
  municipalityIdsFor,
  profileIdOfAuthor,
  profileTargetsFor,
  sameNeighbourhoodName,
  validateOfficialProfile,
  type Organization,
  type OrganizationMember,
  type PermissionGrant,
} from '../index';

const now = new Date('2026-10-28T12:00:00Z');
const org: Organization = {
  id: 'bld-16-nilufer', name: 'Nilüfer Belediyesi', kind: 'ilce-belediyesi', scope: { level: 'ilce', provinceCode: '16', districtId: '16-nilufer' },
  modules: ['gonderiler'], officialEmail: 'bilgi@nilufer.bel.tr', status: 'aktif', createdBy: 'a', createdAt: '',
};
const member = (patch: Partial<OrganizationMember> = {}): OrganizationMember => ({
  orgId: org.id, email: 'ozelkalem@nilufer.bel.tr', displayName: 'Özel Kalem', isOrgAdmin: true, assignments: {}, ...patch,
});
const muhtar: PermissionGrant = {
  id: 'm', email: 'm@b.co', role: 'muhtar', grantedBy: 'x', grantedAt: '',
  scope: { level: 'mahalle', provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' },
  modules: { gonderiler: ['goruntule', 'ekle'] },
};

describe('resmî profil', () => {
  it('alanlar denetlenir: telefon, e-posta, https, uzunluklar', () => {
    expect(validateOfficialProfile({ phone: '0224 123 45 67', email: 'bilgi@nilufer.bel.tr', website: 'https://nilufer.bel.tr', hours: 'Hafta içi 08.30-17.30' }, 'kurum')).toEqual([]);
    expect(validateOfficialProfile({}, 'muhtar')).toEqual([]);
    expect(validateOfficialProfile({ phone: 'ara beni' }, 'kurum')).toEqual(['phone']);
    expect(validateOfficialProfile({ email: 'Bilgi@x' }, 'kurum')).toEqual(['email']);
    expect(validateOfficialProfile({ website: 'http://nilufer.bel.tr' }, 'kurum')).toEqual(['website']);
    expect(validateOfficialProfile({ about: 'a'.repeat(601) }, 'kurum')).toEqual(['about']);
    expect(validateOfficialProfile({ name: 'a'.repeat(81) }, 'muhtar')).toEqual(['name']);
  });

  it('yayınlayanın profili: kurum ve muhtarlık var, il yöneticisinin yok', () => {
    expect(profileIdOfAuthor({ type: 'kurum', orgId: org.id, name: org.name })).toBe(org.id);
    expect(profileIdOfAuthor({ type: 'kisi', role: 'muhtar', grantKey: 'mahalle-16-nilufer-ataevler' })).toBe('mahalle-16-nilufer-ataevler');
    expect(profileIdOfAuthor({ type: 'kisi', role: 'il-yoneticisi', grantKey: 'il-16' })).toBeNull();
  });

  it('mahalle adı eşleşmesi ek ve harf farkına dayanıklı', () => {
    expect(sameNeighbourhoodName('Ataevler Mahallesi', 'ataevler')).toBe(true);
    expect(sameNeighbourhoodName('Ataevler Mahallesi', 'ATAEVLER MAH.')).toBe(true);
    expect(sameNeighbourhoodName('Çamlıca Köyü', 'camlica')).toBe(true);
    expect(sameNeighbourhoodName('Ataevler Mahallesi', 'Ataköy')).toBe(false);
    expect(sameNeighbourhoodName('', '')).toBe(false);
  });

  it('konumun belediyeleri: ilçe + büyükşehir; merkez ilçede yalnızca il belediyesi', () => {
    expect(municipalityIdsFor({ provinceCode: '16', districtId: '16-nilufer' })).toEqual(['bld-16-nilufer', 'bld-16']);
    expect(municipalityIdsFor({ provinceCode: '19', districtId: '19-merkez' })).toEqual(['bld-19']);
    expect(municipalityIdsFor({ provinceCode: '19' })).toEqual(['bld-19']);
  });

  it('düzenlenebilen profiller: kurum yöneticisinin kurumu ve muhtarın mahallesi', () => {
    const list = profileTargetsFor([muhtar], [{ org, member: member() }], now);
    expect(list.map((x) => x.id)).toEqual(['bld-16-nilufer', 'mahalle-16-nilufer-ataevler']);
    expect(list[0]).toMatchObject({ type: 'kurum', name: 'Nilüfer Belediyesi', region: { provinceCode: '16', districtId: '16-nilufer' } });
    expect(list[1].region).toEqual({ provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' });
    // Personel (kurum yöneticisi değil), pasif kurum ve geri alınan yetki sayılmaz.
    expect(profileTargetsFor([], [{ org, member: member({ isOrgAdmin: false }) }], now)).toEqual([]);
    expect(profileTargetsFor([], [{ org: { ...org, status: 'pasif' }, member: member() }], now)).toEqual([]);
    expect(profileTargetsFor([{ ...muhtar, revokedAt: '2026-10-01T00:00:00Z' }], [], now)).toEqual([]);
  });
});
