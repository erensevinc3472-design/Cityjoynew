import { describe, expect, it } from 'vitest';

import {
  ASSIGNABLE_ROLES,
  defaultModulesFor,
  grantDocId,
  grantState,
  GRANTABLE_ACTIONS,
  normalizeModules,
  ROLE_SCOPE_LEVELS,
  ROLE_TEMPLATES,
  type PermissionGrant,
} from '../index';

describe('yetki kayıtları', () => {
  it('belge kimliği kişi ve bölgeden üretilir', () => {
    expect(grantDocId('u1', { level: 'ulke' })).toBe('u1__ulke');
    expect(grantDocId('u1', { level: 'il', provinceCode: '16' })).toBe('u1__il-16');
    expect(grantDocId('u1', { level: 'ilce', provinceCode: '16', districtId: '16-nilufer' })).toBe('u1__ilce-16-nilufer');
    expect(
      grantDocId('u1', { level: 'mahalle', provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' }),
    ).toBe('u1__mahalle-16-nilufer-ataevler');
  });

  it('verilebilir sınırın dışı ayıklanır, görüntüleme kendiliğinden eklenir', () => {
    const m = normalizeModules({ 'acil-numaralar': ['duzenle'], meslekler: ['goruntule'], moderasyon: ['sil'], yetkiler: ['ekle'] });
    expect(m).toEqual({ moderasyon: ['goruntule', 'sil'] });
  });

  it('admin rolü panelden verilmez; her rolün şablonu sınır içindedir ve bölge düzeyi tanımlıdır', () => {
    expect(ASSIGNABLE_ROLES).not.toContain('admin');
    for (const role of ASSIGNABLE_ROLES) {
      const m = defaultModulesFor(role, ROLE_TEMPLATES);
      for (const [mod, actions] of Object.entries(m)) {
        expect(actions!.every((a) => GRANTABLE_ACTIONS[mod as keyof typeof GRANTABLE_ACTIONS]!.includes(a))).toBe(true);
      }
      expect(ROLE_SCOPE_LEVELS[role].length).toBeGreaterThan(0);
    }
    expect(ROLE_SCOPE_LEVELS['il-yoneticisi']).toEqual(['il']);
  });

  it('durum: etkin, süresi doldu, geri alındı', () => {
    const g: PermissionGrant = {
      id: 'x', uid: 'u', role: 'muhtar', grantedBy: 'a', grantedAt: '',
      scope: { level: 'mahalle', provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' },
      modules: { konumlar: ['goruntule'] },
    };
    const now = new Date('2026-10-27T00:00:00Z');
    expect(grantState(g, now)).toBe('aktif');
    expect(grantState({ ...g, expiresAt: '2026-10-01T00:00:00Z' }, now)).toBe('suresi-doldu');
    expect(grantState({ ...g, revokedAt: '2026-10-20T00:00:00Z' }, now)).toBe('geri-alindi');
  });
});
