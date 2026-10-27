import { describe, expect, it } from 'vitest';

import {
  approvalDocId,
  bulkApprovable,
  filterApprovals,
  isSafeApproval,
  trustedApproverDocId,
  validRejectReason,
  type Approval,
  type TrustedApprover,
} from '../index';

const ahmet = { uid: 'ahmet', email: 'ahmet@ornek.com', name: 'Ahmet Yılmaz', at: '2026-10-27T10:00:00Z' };

const approval = (patch: Partial<Approval> = {}): Approval => ({
  id: 'isletme-dogrulama__b1',
  kind: 'isletme-dogrulama',
  module: 'isletme-dogrulama',
  targetId: 'b1',
  title: 'Usta Tesisat',
  region: { provinceCode: '16', districtId: '16-nilufer' },
  status: 'admin-onayi-bekliyor',
  requestedBy: 'sahip',
  requestedAt: '2026-10-26T10:00:00Z',
  firstApproval: ahmet,
  ...patch,
});

const trusted = (patch: Partial<TrustedApprover> = {}): TrustedApprover => ({
  id: 'x',
  email: 'Ahmet@Ornek.com',
  displayName: 'Ahmet Yılmaz',
  provinceCode: '16',
  modules: [],
  addedBy: 'eren',
  addedAt: '2026-10-01T00:00:00Z',
  ...patch,
});

describe('onay merkezi', () => {
  it('belge kimlikleri tür + hedef ve e-posta + bölgeden üretilir', () => {
    expect(approvalDocId('isletme-dogrulama', 'b1')).toBe('isletme-dogrulama__b1');
    expect(trustedApproverDocId('Ahmet@Ornek.com', '16')).toBe('ahmet@ornek.com__il-16');
    expect(trustedApproverDocId('a@b.co', '16', '16-nilufer')).toBe('a@b.co__ilce-16-nilufer');
  });

  it('güvenli: ilk aşamayı güvenilir yönetici, kendi il / ilçe / kategorisinde onayladıysa', () => {
    expect(isSafeApproval(approval(), [trusted()])).toBe(true);
    expect(isSafeApproval(approval(), [trusted({ districtId: '16-nilufer', modules: ['isletme-dogrulama'] })])).toBe(true);
    // Başka ilçe, başka kategori, başka il, listeden çıkarılmış, başka kişi.
    expect(isSafeApproval(approval(), [trusted({ districtId: '16-osmangazi' })])).toBe(false);
    expect(isSafeApproval(approval(), [trusted({ modules: ['bildirimler'] })])).toBe(false);
    expect(isSafeApproval(approval(), [trusted({ provinceCode: '34' })])).toBe(false);
    expect(isSafeApproval(approval(), [trusted({ removedAt: '2026-10-20T00:00:00Z' })])).toBe(false);
    expect(isSafeApproval(approval({ firstApproval: { ...ahmet, email: 'veli@ornek.com' } }), [trusted()])).toBe(false);
  });

  it('ilk aşamadan geçmemiş ve yüksek riskli işler güvenli sayılmaz ve toplu onaya girmez', () => {
    const waiting = approval({ id: 'a2', status: 'il-onayi-bekliyor', firstApproval: undefined });
    const risky = approval({ id: 'a3', kind: 'hesap-kapatma', module: 'moderasyon' });
    const done = approval({ id: 'a4', status: 'onaylandi' });
    expect(isSafeApproval(waiting, [trusted()])).toBe(false);
    expect(isSafeApproval(risky, [trusted()])).toBe(false);
    const list = [approval(), waiting, risky, done];
    expect(bulkApprovable(list, 'tumu').map((a) => a.id)).toEqual(['isletme-dogrulama__b1', 'a2']);
    expect(bulkApprovable(list, 'guvenli', [trusted()]).map((a) => a.id)).toEqual(['isletme-dogrulama__b1']);
    expect(bulkApprovable(list, 'guvenli', [])).toEqual([]);
  });

  it('süzgeç: il, ilçe, kategori, aşama; aşama seçilmezse yalnızca bekleyenler', () => {
    const list = [
      approval(),
      approval({ id: 'b', region: { provinceCode: '34', districtId: '34-kadikoy' } }),
      approval({ id: 'c', status: 'reddedildi' }),
      approval({ id: 'd', status: 'il-onayi-bekliyor', firstApproval: undefined }),
    ];
    expect(filterApprovals(list, {}).map((a) => a.id)).toEqual(['isletme-dogrulama__b1', 'b', 'd']);
    expect(filterApprovals(list, { provinceCode: '34' }).map((a) => a.id)).toEqual(['b']);
    expect(filterApprovals(list, { districtId: '16-nilufer', status: 'il-onayi-bekliyor' }).map((a) => a.id)).toEqual(['d']);
    expect(filterApprovals(list, { module: 'bildirimler' })).toEqual([]);
    expect(filterApprovals(list, { status: 'reddedildi' }).map((a) => a.id)).toEqual(['c']);
    expect(filterApprovals(list, { status: 'sonuclanan' }).map((a) => a.id)).toEqual(['c']);
  });

  it('ret gerekçesi zorunlu (5-300 karakter)', () => {
    expect(validRejectReason('  ')).toBe(false);
    expect(validRejectReason('yok')).toBe(false);
    expect(validRejectReason('Adres doğrulanamadı')).toBe(true);
    expect(validRejectReason('x'.repeat(301))).toBe(false);
  });
});
