import { describe, expect, it } from 'vitest';

import { cleanSuggestions, filterBySearch, matchesSearch, pushRecentSearch, searchKeyCandidates, searchKeys, withinOneEdit } from '../index';

describe('arama', () => {
  it('anahtarlar kelime başlarıdır; Türkçe karakter ve büyük harf farkı yoktur', () => {
    expect(searchKeys('Şükrü Berber', 40)).toEqual(['su', 'suk', 'sukr', 'sukru', 'be', 'ber', 'berb', 'berbe', 'berber']);
    expect(searchKeys('İnegöl köftecisi', 100)).toContain('inegol');
    expect(searchKeys('Ayşe K.', 40)).toEqual(['ay', 'ays', 'ayse']);
    expect(searchKeys('bir iki üç dört', 3)).toHaveLength(3);
    expect(searchKeys('ab', 10, 3)).toEqual([]);
  });

  it('sorgu anahtarı en uzun kelimedir, yazım hatası için kısaltılmışları da döner', () => {
    expect(searchKeyCandidates('ali berbr')).toEqual(['berbr', 'berb', 'ber']);
    expect(searchKeyCandidates('KUAFÖR')).toEqual(['kuafor', 'kuafo', 'kuaf']);
    expect(searchKeyCandidates('a')).toEqual([]);
    expect(searchKeyCandidates('ab', 3)).toEqual([]);
  });

  it('bir harf hatası kabul edilir', () => {
    expect(withinOneEdit('berbe', 'berbr')).toBe(true);
    expect(withinOneEdit('eczane', 'eczne')).toBe(true);
    expect(withinOneEdit('eczane', 'ecz')).toBe(false);
    expect(matchesSearch('Nilüfer Eczanesi', 'eczne')).toBe(true);
    expect(matchesSearch('Nilüfer Eczanesi', 'eczne', false)).toBe(false);
    expect(matchesSearch('Ataevler Parkı', 'park ataev')).toBe(true);
    expect(matchesSearch('Ataevler Parkı', 'park bahçe')).toBe(false);
    // Kısa kelimede ve fazladan harfte tolerans yok (ilgisiz sonuç gelmesin).
    expect(matchesSearch('Parça eşya taşıma', 'park')).toBe(false);
    expect(matchesSearch('Sürücü kursu', 'sukru')).toBe(false);
  });

  it('kesin eşleşmeler önce gelir', () => {
    const list = ['Berbat Kafe', 'Berber Ali'];
    expect(filterBySearch(list, 'berber', (x) => x)).toEqual(['Berber Ali']);
    expect(filterBySearch(['Berber Ali', 'Berbr Kuaför'], 'berbr', (x) => x)).toEqual(['Berbr Kuaför', 'Berber Ali']);
  });

  it('son aramalar ve önerilen aramalar temizlenir', () => {
    expect(pushRecentSearch(['berber', 'park'], ' Park ')).toEqual(['Park', 'berber']);
    expect(pushRecentSearch([], 'a')).toEqual([]);
    expect(cleanSuggestions([' Nöbetçi eczane ', 'nobetci ECZANE', 'x', 'Berber'])).toEqual(['Nöbetçi eczane', 'Berber']);
  });
});

describe('arama kapsamı (Eren, 13 Kasım 2026)', () => {
  it('Türkiye geneli sonuçta önce ilçe, sonra il, sonra diğer iller; grup içi sıra korunur', async () => {
    const { nearFirst } = await import('../index');
    const list = [
      { id: 'a', p: { provinceCode: '07', districtId: '07-alanya' } },
      { id: 'b', p: { provinceCode: '16', districtId: '16-nilufer' } },
      { id: 'c', p: { provinceCode: '16', districtId: '16-osmangazi' } },
      { id: 'd', p: { provinceCode: '34' } },
      { id: 'e', p: { provinceCode: '16', districtId: '16-osmangazi' } },
    ];
    const out = nearFirst(list, { provinceCode: '16', districtId: '16-osmangazi' }, (x) => x.p).map((x) => x.id);
    expect(out).toEqual(['c', 'e', 'b', 'a', 'd']);
    expect(nearFirst(list, {}, (x) => x.p).map((x) => x.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('meslek yazılınca hizmet araması, işletme adı yazılınca değil; eş anlamlılar da sayılır', async () => {
    const { isServiceQuery, uniqueById } = await import('../index');
    const cats = [
      { names: { tr: 'Hırdavat', en: 'Hardware store' }, keywords: 'hırdavatçı, nalbur' },
      { names: { tr: 'Kuaför' }, keywords: 'berber, saç' },
    ];
    expect(isServiceQuery(cats, 'hırdavat')).toBe(true);
    expect(isServiceQuery(cats, 'hirdavatci')).toBe(true);
    expect(isServiceQuery(cats, 'nalbur')).toBe(true);
    expect(isServiceQuery(cats, 'Berber')).toBe(true);
    expect(isServiceQuery(cats, 'hardware')).toBe(true);
    expect(isServiceQuery(cats, 'Emre Hırdavat')).toBe(false);
    expect(isServiceQuery(cats, 'Ulu Cami')).toBe(false);
    expect(uniqueById([{ id: '1' }, { id: '2' }, { id: '1' }]).map((x) => x.id)).toEqual(['1', '2']);
  });
});
