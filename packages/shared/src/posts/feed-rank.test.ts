import { describe, expect, it } from 'vitest';

import { rankFeed, rankScore, spreadAuthors, type RankItem } from './feed-rank';

const NOW = new Date('2026-11-12T12:00:00Z').getTime();
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const item = (id: string, over: Partial<RankItem> = {}): RankItem & { id: string } => ({ id, at: ago(2), authorKey: id, ...over });

describe('Senin için sıralaması', () => {
  it('çok beğenilen paylaşım biraz daha eski olsa da öne geçer, ama bir gün öncesi tazeyi geçemez', () => {
    expect(rankScore(item('a', { at: ago(4), likes: 30 }), NOW)).toBeGreaterThan(rankScore(item('b', { at: ago(2) }), NOW));
    expect(rankScore(item('a', { at: ago(48), likes: 30 }), NOW)).toBeLessThan(rankScore(item('b', { at: ago(2), likes: 2 }), NOW));
  });

  it('yorum beğeniden değerli; takip ve mahalle öne alır; şikâyet geri düşürür', () => {
    expect(rankScore(item('a', { comments: 3 }), NOW)).toBeGreaterThan(rankScore(item('b', { likes: 3 }), NOW));
    expect(rankScore(item('a', { followed: true }), NOW)).toBeGreaterThan(rankScore(item('b'), NOW));
    expect(rankScore(item('a', { nearby: true }), NOW)).toBeGreaterThan(rankScore(item('b'), NOW));
    expect(rankScore(item('a', { likes: 10, reports: 2 }), NOW)).toBeLessThan(rankScore(item('b', { likes: 2 }), NOW));
  });

  it('yeni paylaşım ilk saatte etkileşimsiz de görünür', () => {
    expect(rankScore(item('yeni', { at: ago(0.2) }), NOW)).toBeGreaterThan(rankScore(item('eski', { at: ago(5), likes: 3 }), NOW));
  });

  it('aynı kişi arka arkaya gelmez; tek kişi varsa sıra korunur', () => {
    const out = spreadAuthors(['a1', 'a2', 'a3', 'b1', 'c1'], (x) => x[0]);
    for (let i = 1; i < out.length; i++) if (out[i][0] === out[i - 1][0]) expect(out.slice(i).every((x) => x[0] === out[i][0])).toBe(true);
    expect(out[0]).toBe('a1');
    expect(out[1]).toBe('b1');
    expect(spreadAuthors(['a1', 'a2'], (x) => x[0])).toEqual(['a1', 'a2']);
  });

  it('bloklar ayrı sıralanır: ikinci sayfadaki popüler paylaşım ilk sayfaya sıçramaz', () => {
    const list = [item('x', { at: ago(1) }), item('y', { at: ago(2) }), item('z', { at: ago(3), likes: 500 })];
    const out = rankFeed(list, (x) => x, NOW, 2).map((x) => x.id);
    expect(out[2]).toBe('z');
    expect(rankFeed(list, (x) => x, NOW, 3)[0].id).toBe('z');
  });
});
