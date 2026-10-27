import { describe, expect, it } from 'vitest';

import {
  can,
  defaultModulesFor,
  DELEGABLE_ROLES,
  grantDocId,
  grantState,
  intersectCaps,
  membershipToGrant,
  normalizeModules,
  PERSON_ROLES,
  ROLE_CAPS,
  ROLE_SCOPE_LEVELS,
  ROLE_TEMPLATES,
  type Organization,
  type PermissionGrant,
} from '../index';

describe('yetki kayıtları', () => {
  it('belge kimliği e-posta (küçük harf) ve bölgeden üretilir', () => {
    expect(grantDocId('Ahmet@Ornek.com', { level: 'ulke' })).toBe('ahmet@ornek.com__ulke');
    expect(grantDocId('a@b.co', { level: 'il', provinceCode: '16' })).toBe('a@b.co__il-16');
    expect(
      grantDocId('a@b.co', { level: 'mahalle', provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' }),
    ).toBe('a@b.co__mahalle-16-nilufer-ataevler');
  });

  it('rolün sınırı dışı ayıklanır, görüntüleme kendiliğinden eklenir', () => {
    const m = normalizeModules({ 'acil-numaralar': ['duzenle'], meslekler: ['goruntule'], moderasyon: ['sil'], yetkiler: ['ekle'] }, ROLE_CAPS.moderator);
    expect(m).toEqual({});
    expect(normalizeModules({ moderasyon: ['duzenle'] }, ROLE_CAPS.moderator)).toEqual({ moderasyon: ['goruntule', 'duzenle'] });
  });

  it('il yöneticisi yalnızca muhtar ve moderatör verir; verdiği her şey kendi sınırında', () => {
    expect(DELEGABLE_ROLES['il-yoneticisi']).toEqual(['muhtar', 'moderator']);
    for (const role of DELEGABLE_ROLES['il-yoneticisi']) {
      expect(intersectCaps(ROLE_CAPS[role], ROLE_CAPS['il-yoneticisi'])).toEqual(ROLE_CAPS[role]);
    }
    for (const role of PERSON_ROLES) {
      const m = defaultModulesFor(role, ROLE_TEMPLATES);
      expect(normalizeModules(m, ROLE_CAPS[role])).toEqual(m);
      expect(ROLE_SCOPE_LEVELS[role].length).toBeGreaterThan(0);
    }
  });

  it('durum: etkin, süresi doldu, geri alındı', () => {
    const g = { revokedAt: undefined, expiresAt: undefined };
    const now = new Date('2026-10-27T00:00:00Z');
    expect(grantState(g, now)).toBe('aktif');
    expect(grantState({ expiresAt: '2026-10-01T00:00:00Z' }, now)).toBe('suresi-doldu');
    expect(grantState({ revokedAt: '2026-10-20T00:00:00Z' }, now)).toBe('geri-alindi');
  });

  it('kurum görevi panel yetkisine dönüşür: hazırlayan onaylayamaz, kurum yöneticisi personel yönetir', () => {
    const org: Organization = {
      id: 'bld-16-nilufer', name: 'Nilüfer Belediyesi', kind: 'ilce-belediyesi',
      scope: { level: 'ilce', provinceCode: '16', districtId: '16-nilufer' }, modules: ['gonderiler', 'bildirimler'],
      officialEmail: 'bilgi@nilufer.bel.tr', status: 'aktif', createdBy: 'admin', createdAt: '',
    };
    const basin = membershipToGrant(org, { orgId: org.id, email: 'basin@nilufer.bel.tr', displayName: 'Basın', isOrgAdmin: false, assignments: { gonderiler: { role: 'hazirlayan' } } });
    const region = { provinceCode: '16', districtId: '16-nilufer' };
    const grants: PermissionGrant[] = [basin];
    expect(basin.role).toBe('belediye');
    expect(can(grants, { module: 'gonderiler', action: 'ekle', region })).toBe(true);
    expect(can(grants, { module: 'gonderiler', action: 'onayla', region })).toBe(false);
    expect(can(grants, { module: 'gonderiler', action: 'ekle', region: { provinceCode: '16', districtId: '16-osmangazi' } })).toBe(false);
    expect(can(grants, { module: 'kurumlar', action: 'ekle', region })).toBe(false);

    const kalem = membershipToGrant(org, { orgId: org.id, email: 'kalem@nilufer.bel.tr', displayName: 'Özel kalem', isOrgAdmin: true, assignments: {} });
    expect(can([kalem], { module: 'kurumlar', action: 'ekle', region })).toBe(true);
    expect(can([kalem], { module: 'bildirimler', action: 'goruntule', region })).toBe(true);
  });
});
