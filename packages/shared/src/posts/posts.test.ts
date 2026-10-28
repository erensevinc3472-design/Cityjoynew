import { describe, expect, it } from 'vitest';

import { isCommentListed, isPostListed, looksLikeRealEstate, normalizeTargets, validateComment, validatePost, type PostInput } from '../index';

const input = (patch: Partial<PostInput> = {}): PostInput => ({
  text: 'Parktaki banklar yenilenmiş, teşekkürler!',
  category: 'genel',
  targets: ['mahallem'],
  region: { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '16-nilufer-ataevler' },
  ...patch,
});

describe('Keşfet gönderileri', () => {
  it('alanlar denetlenir: metin, kategori, en az bir hedef, kendi bölgesi', () => {
    expect(validatePost(input())).toEqual([]);
    expect(validatePost(input({ targets: ['mahallem', 'bolgesel', 'genel'] }))).toEqual([]);
    expect(validatePost(input({ text: '   ' }))).toEqual(['text']);
    expect(validatePost(input({ text: 'a'.repeat(2001) }))).toEqual(['text']);
    expect(validatePost(input({ targets: [] }))).toEqual(['targets']);
    expect(validatePost(input({ targets: ['mahallem', 'mahallem'] }))).toEqual(['targets']);
    expect(validatePost(input({ category: 'reklam' as never }))).toEqual(['category']);
    expect(validatePost(input({ region: { provinceCode: '16', districtId: '16-nilufer', neighbourhoodId: '34-kadikoy-moda' } }))).toEqual(['region']);
  });

  it('emlak ilanı sezilir (madde 9), sıradan sözler takılmaz', () => {
    expect(looksLikeRealEstate('Sahibinden SATILIK 3+1 daire, acil')).toBe(true);
    expect(looksLikeRealEstate('Kiralık müstakil ev arıyorum')).toBe(true);
    expect(looksLikeRealEstate('Flat for rent near the park')).toBe(false);
    expect(looksLikeRealEstate('For rent: flat near the park')).toBe(true);
    expect(looksLikeRealEstate('Satılık bisiklet, az kullanılmış')).toBe(false);
    expect(looksLikeRealEstate('Evde kek yaptık')).toBe(false);
    expect(looksLikeRealEstate('Satılık bisiklet evde duruyor')).toBe(false);
    expect(looksLikeRealEstate('Kiralık sevimli bir köpek kulübesi değil')).toBe(false);
    expect(validatePost(input({ text: 'Kiralık daire 15.000 TL' }))).toEqual(['realEstate']);
  });

  it('şikâyetle düşme ve kaldırma', () => {
    expect(isPostListed({ status: 'aktif', reportCount: 2, cleared: false })).toBe(true);
    expect(isPostListed({ status: 'aktif', reportCount: 3, cleared: false })).toBe(false);
    expect(isPostListed({ status: 'aktif', reportCount: 5, cleared: true })).toBe(true);
    expect(isPostListed({ status: 'kaldirildi', reportCount: 0, cleared: true })).toBe(false);
  });

  it('yorum: 1-500 karakter, şikâyetle gizlenir', () => {
    expect(validateComment('Harika!')).toBe(true);
    expect(validateComment('  ')).toBe(false);
    expect(validateComment('a'.repeat(501))).toBe(false);
    expect(isCommentListed({ reportCount: 3, cleared: false })).toBe(false);
    expect(isCommentListed({ reportCount: 3, cleared: true })).toBe(true);
  });

  it('hedefler sabit sırada', () => {
    expect(normalizeTargets(['genel', 'mahallem'])).toEqual(['mahallem', 'genel']);
  });
});
