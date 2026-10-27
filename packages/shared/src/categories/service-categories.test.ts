import { describe, expect, it } from 'vitest';

import {
  buildCategoryTree,
  createServiceCategoryStore,
  DEFAULT_SERVICE_CATEGORIES,
  isValidSuggestion,
  searchCategoryTree,
  type ServiceCategory,
} from './service-categories';

const cat = (id: string, parentId: string | null, order: number, active = true): ServiceCategory => ({
  id, parentId, names: { tr: id }, icon: 'category', order, active,
});

const memoryCache = () => {
  const m = new Map<string, string>();
  return { get: async (k: string) => m.get(k) ?? null, set: async (k: string, v: string) => void m.set(k, v) };
};

describe('hizmet kategorileri', () => {
  it('başlangıç listesi: 14 ana kategori, beş dil, benzersiz kimlik, acil kategoriler işaretli', () => {
    const tree = buildCategoryTree([]);
    expect(tree).toHaveLength(14);
    const ids = DEFAULT_SERVICE_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of DEFAULT_SERVICE_CATEGORIES) expect(Object.keys(c.names).sort()).toEqual(['ar', 'de', 'en', 'ru', 'tr']);
    const urgent = DEFAULT_SERVICE_CATEGORIES.filter((c) => c.urgent).map((c) => c.id);
    expect(urgent).toEqual(expect.arrayContaining(['cilingir', 'cekici', 'tesisatci']));
    // Nöbetçi eczane ayrı özellik; kategori değil.
    expect(ids.join()).not.toMatch(/eczane/);
  });

  it('pasif ana kategori alt kategorileriyle gizlenir, alt kategorisi kalmayan ana kategori gösterilmez', () => {
    const tree = buildCategoryTree([
      cat('b', null, 2), cat('a', null, 1), cat('c', null, 3, false), cat('d', null, 4),
      cat('a2', 'a', 2), cat('a1', 'a', 1), cat('b1', 'b', 1), cat('c1', 'c', 1), cat('d1', 'd', 1, false),
    ]);
    expect(tree.map((n) => [n.category.id, n.children.map((c) => c.id)])).toEqual([['a', ['a1', 'a2']], ['b', ['b1']]]);
  });

  it('arama Türkçe karakter duyarsız, seçili dilde ve Türkçede arar', () => {
    const tree = buildCategoryTree([]);
    const ids = (q: string, l: 'tr' | 'en' = 'tr') => searchCategoryTree(tree, q, l).flatMap((n) => n.children.map((c) => c.id));
    expect(ids('cilingir')).toEqual(['cilingir']);
    expect(ids('locksmith', 'en')).toEqual(['cilingir']);
    expect(ids('çilingir', 'en')).toEqual(['cilingir']);
    // Ana kategori eşleşirse tüm alt kategorileri gelir.
    expect(ids('evcil hayvan').length).toBeGreaterThanOrEqual(5);
    expect(ids('')).toHaveLength(88);
  });

  it('liste yalnızca sürüm damgası değişince indirilir', async () => {
    let version: string | null = null;
    let downloads = 0;
    const store = createServiceCategoryStore(
      { version: async () => version, listAll: async () => (downloads++, [cat('a', null, 1), cat('a1', 'a', 1)]) },
      memoryCache(),
    );
    expect(await store.refresh()).toEqual([]);
    version = 'v1';
    await store.refresh();
    await store.refresh();
    expect(downloads).toBe(1);
    version = 'v2';
    await store.refresh();
    expect(downloads).toBe(2);
    expect((await store.cached()).map((c) => c.id)).toEqual(['a', 'a1']);
  });

  it('öneri metni 3-300 karakter', () => {
    expect(isValidSuggestion('  ab ')).toBe(false);
    expect(isValidSuggestion('Kilim tamiri')).toBe(true);
    expect(isValidSuggestion('x'.repeat(301))).toBe(false);
  });
});
