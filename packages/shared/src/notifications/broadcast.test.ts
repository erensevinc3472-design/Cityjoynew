import { describe, expect, it } from 'vitest';

import type { Organization, OrganizationMember } from '../organizations/types';
import type { PermissionGrant } from '../permissions/types';
import { broadcastNeedsApproval, broadcastersFor, reachShown, validateBroadcast, type BroadcastInput } from './broadcast';

const ok: BroadcastInput = { publisherKey: 'k', kind: 'duyuru', title: 'Su kesintisi', body: 'Yarın 09.00-17.00 arası.', region: { provinceCode: '16', districtId: '16-nilufer' } };

describe('toplu bildirim', () => {
  it('başlık, metin, tür ve bölge denetlenir', () => {
    expect(validateBroadcast(ok)).toEqual([]);
    expect(validateBroadcast({ ...ok, title: 'ab', body: 'kısa' })).toEqual(['title', 'body']);
    expect(validateBroadcast({ ...ok, kind: 'kampanya' as never })).toEqual(['kind']);
    expect(validateBroadcast({ ...ok, region: { provinceCode: '16', districtId: '34-kadikoy' } })).toEqual(['region']);
    expect(validateBroadcast({ ...ok, region: { provinceCode: '16', neighbourhoodId: '16-nilufer-x' } })).toEqual(['region']);
  });

  it('il geneli admin dışında onaya gider; küçük grupta sayı gösterilmez', () => {
    expect(broadcastNeedsApproval({ provinceCode: '16' }, false)).toBe(true);
    expect(broadcastNeedsApproval({ provinceCode: '16' }, true)).toBe(false);
    expect(broadcastNeedsApproval(ok.region, false)).toBe(false);
    expect(reachShown(49)).toBeNull();
    expect(reachShown(50)).toBe(50);
  });

  it('gönderebilen hesaplar: "Bildirim gönder" görevi olan kurum ve kişi yetkisi; admin için CityJoy', () => {
    const org = { id: 'bld', name: 'Nilüfer Belediyesi', status: 'aktif', modules: ['bildirimler'], scope: { level: 'ilce', provinceCode: '16', districtId: '16-nilufer' } } as unknown as Organization;
    const member = (actions: string[]) => ({ orgId: 'bld', email: 'a@b.c', assignments: { bildirimler: actions } }) as unknown as OrganizationMember;
    const grant = (actions: string[]) => ({ id: 'g', email: 'a@b.c', role: 'muhtar', scope: { level: 'mahalle', provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-m' }, modules: { bildirimler: actions }, grantedBy: 'x', grantedAt: '' }) as unknown as PermissionGrant;
    expect(broadcastersFor([grant(['goruntule', 'bildirim-gonder'])], [{ org, member: member(['bildirim-gonder']) }], false).map((p) => p.key)).toEqual(['bld', 'mahalle-16-nilufer-m']);
    expect(broadcastersFor([grant(['goruntule'])], [{ org, member: member(['goruntule']) }], false)).toEqual([]);
    expect(broadcastersFor([], [], true).map((p) => p.key)).toEqual(['cityjoy']);
  });
});
