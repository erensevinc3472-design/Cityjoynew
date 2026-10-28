import { describe, expect, it } from 'vitest';

import {
  canPublishDirectly,
  isForLocation,
  isAnnouncementLive,
  isNotice,
  publishersFor,
  readingMinutes,
  regionWithin,
  sortForFeed,
  validateAnnouncement,
  type AnnouncementInput,
  type Organization,
  type PermissionGrant,
} from '../index';

const now = new Date('2026-10-27T12:00:00Z');
const nilufer = { level: 'ilce', provinceCode: '16', districtId: '16-nilufer' } as const;
const ataevler = { level: 'mahalle', provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' } as const;
const input = (patch: Partial<AnnouncementInput> = {}): AnnouncementInput => ({
  kind: 'duyuru',
  title: 'Su kesintisi',
  body: 'Yarın 09.00-13.00 arasında su kesintisi olacaktır.',
  region: { provinceCode: '16', districtId: '16-nilufer' },
  ...patch,
});

describe('resmî duyurular', () => {
  it('hedef bölge yayınlayanın bölgesinin içinde olmalı', () => {
    expect(regionWithin({ provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' }, nilufer)).toBe(true);
    expect(regionWithin({ provinceCode: '16' }, nilufer)).toBe(false);
    expect(regionWithin({ provinceCode: '16', districtId: '16-osmangazi' }, nilufer)).toBe(false);
    expect(regionWithin({ provinceCode: '16', districtId: '16-nilufer' }, ataevler)).toBe(false);
    expect(regionWithin({ provinceCode: '34' }, { level: 'ulke' })).toBe(true);
  });

  it('başlık, metin, bölge ve acil duyurunun bitişi denetlenir', () => {
    expect(validateAnnouncement(input(), nilufer, now)).toEqual([]);
    expect(validateAnnouncement(input({ title: 'a', body: 'kısa' }), nilufer, now)).toEqual(['title', 'body']);
    expect(validateAnnouncement(input({ region: { provinceCode: '16' } }), nilufer, now)).toEqual(['region']);
    // Acil duyuruda bitiş zorunlu, en çok 7 gün.
    expect(validateAnnouncement(input({ kind: 'acil' }), nilufer, now)).toEqual(['endsAt']);
    expect(validateAnnouncement(input({ kind: 'acil', endsAt: '2026-10-28T12:00:00Z' }), nilufer, now)).toEqual([]);
    expect(validateAnnouncement(input({ kind: 'acil', endsAt: '2026-11-10T12:00:00Z' }), nilufer, now)).toEqual(['endsAt']);
    expect(validateAnnouncement(input({ endsAt: '2026-10-01T00:00:00Z' }), nilufer, now)).toEqual(['endsAt']);
  });

  it('kurum haberi: kategori zorunlu, duyuruda kategori olmaz, haber sabitlenmez; okuma süresi', () => {
    expect(validateAnnouncement(input({ kind: 'haber', category: 'kultur-sanat' }), nilufer, now)).toEqual([]);
    expect(validateAnnouncement(input({ kind: 'haber' }), nilufer, now)).toEqual(['category']);
    expect(validateAnnouncement(input({ category: 'spor' }), nilufer, now)).toEqual(['category']);
    expect(validateAnnouncement(input({ kind: 'haber', category: 'spor', pinned: true, region: { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' } }), nilufer, now)).toEqual(['pinned']);
    expect(isNotice({ kind: 'haber' })).toBe(false);
    expect(isNotice({ kind: 'acil' })).toBe(true);
    expect(readingMinutes('kelime '.repeat(450))).toBe(2);
    expect(readingMinutes('kısa')).toBe(1);
  });

  it('kullanıcı il genelini, kendi ilçesini ve mahallesini görür; acil en üstte; süresi geçen gösterilmez', () => {
    const loc = { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' };
    expect(isForLocation({ region: { provinceCode: '16' } }, loc)).toBe(true);
    expect(isForLocation({ region: { provinceCode: '16', districtId: '16-osmangazi' } }, loc)).toBe(false);
    expect(isForLocation({ region: { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-baska' } }, loc)).toBe(false);
    expect(isAnnouncementLive({ status: 'yayinda', endsAt: '2026-10-27T11:00:00Z' }, now)).toBe(false);
    expect(isAnnouncementLive({ status: 'onay-bekliyor' }, now)).toBe(false);
    const feed = sortForFeed([
      { id: 'eski', kind: 'duyuru' as const, publishedAt: '2026-10-20' },
      { id: 'acil', kind: 'acil' as const, publishedAt: '2026-10-01' },
      { id: 'yeni', kind: 'duyuru' as const, publishedAt: '2026-10-26' },
    ]);
    expect(feed.map((a) => a.id)).toEqual(['acil', 'yeni', 'eski']);
    // Sabitlenen: acilden sonra, diğerlerinden önce.
    const withPinned = sortForFeed([...feed, { id: 'sabit', kind: 'duyuru' as const, publishedAt: '2026-09-01', pinned: true }]);
    expect(withPinned.map((a) => a.id)).toEqual(['acil', 'sabit', 'yeni', 'eski']);
  });

  it('sabitleme yalnızca mahalleye yönelik, acil olmayan duyuruda', () => {
    const mahalle = { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' };
    expect(validateAnnouncement(input({ region: mahalle, pinned: true }), ataevler, now)).toEqual([]);
    expect(validateAnnouncement(input({ pinned: true }), nilufer, now)).toEqual(['pinned']);
    expect(validateAnnouncement(input({ region: mahalle, kind: 'acil', endsAt: '2026-10-28T12:00:00Z', pinned: true }), ataevler, now)).toEqual(['pinned']);
  });

  it('yayınlayan hesaplar: kurum görevi ve muhtar / il yöneticisi yetkisi; onaysız yayınlama işaretten gelir', () => {
    const org: Organization = {
      id: 'bld-16-nilufer', name: 'Nilüfer Belediyesi', kind: 'ilce-belediyesi', scope: nilufer,
      modules: ['gonderiler', 'bildirimler'], officialEmail: 'a@b.co', status: 'aktif', createdBy: 'x', createdAt: '',
    };
    const member = { orgId: org.id, email: 'basin@b.co', displayName: 'Basın', isOrgAdmin: false, assignments: { gonderiler: ['goruntule' as const, 'ekle' as const] } };
    const muhtar: PermissionGrant = {
      id: 'm', email: 'm@b.co', role: 'muhtar', scope: ataevler, grantedBy: 'x', grantedAt: '',
      modules: { gonderiler: ['goruntule', 'ekle', 'yayinla'] },
    };
    const moderator: PermissionGrant = { ...muhtar, id: 'mod', role: 'moderator', modules: { moderasyon: ['goruntule'] } };
    const list = publishersFor([muhtar, moderator], [{ org, member }], now);
    expect(list.map((p) => p.key)).toEqual(['bld-16-nilufer', 'mahalle-16-nilufer-ataevler']);
    expect(list.map(canPublishDirectly)).toEqual([false, true]);
    expect(list[1]!.author).toEqual({ type: 'kisi', role: 'muhtar', grantKey: 'mahalle-16-nilufer-ataevler' });
    // Pasif kurumda yayınlanamaz.
    expect(publishersFor([], [{ org: { ...org, status: 'pasif' }, member }], now)).toEqual([]);
  });
});
