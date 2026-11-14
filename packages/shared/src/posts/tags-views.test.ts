import { describe, expect, it } from 'vitest';

import { compactCount, POST_LIMITS, postTagRequest } from './posts';

describe('etiket isteği', () => {
  it('seçilenler ve "bahset" çıkartmaları birleşir; kendisi, tekrar ve geçersiz kimlik düşer; en çok 20', () => {
    const edits = [{ items: [{ kind: 'cikartma', type: 'bahset', uid: 'veli' }, { kind: 'cikartma', type: 'bahset', uid: 'ali' }, { kind: 'yazi' }] }] as never;
    expect(postTagRequest('ayse', ['ali', 'ayse', 'kötü id', ''], edits)).toEqual(['ali', 'veli']);
    expect(postTagRequest('ayse', undefined, undefined)).toEqual([]);
    expect(postTagRequest('ayse', Array.from({ length: 30 }, (_, i) => `u${i}`), undefined)).toHaveLength(POST_LIMITS.tags);
  });
});

describe('izlenme sayısının kısa yazımı', () => {
  it('10 binin altında tam sayı, üstünde kısa biçim', () => {
    expect(compactCount(950, 'tr')).toBe('950');
    expect(compactCount(4579, 'tr')).toBe('4.579');
    expect(compactCount(15_600, 'tr')).toMatch(/^15,6\s?B$/);
    expect(compactCount(1_200_000, 'en')).toBe('1.2M');
  });
});
