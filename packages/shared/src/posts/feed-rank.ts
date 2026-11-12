/**
 * Keşfet "Senin için" sıralaması (Eren, 12 Kasım 2026: "insanların keyif almasını amaçlıyoruz", A seçeneği). Kurallar
 * herkes için aynı ve açık (uygulamada "Nasıl sıralanıyor?"): tazelik, beğeni/yorum, takip ettiklerin ve kendi mahallen,
 * aynı kişi arka arkaya gelmez, şikâyet alan geri düşer. Bilerek yok: izlenme süresi takibi, öfke/tartışma ödülü,
 * parayla gizli öne çıkma. "En yeni" seçeneği her zaman zaman sırasıdır.
 *
 * Sunucu yok: telefon zaten okuduğu sayfayı kendi içinde sıralar (maliyet ilkesi). Sayfalar ayrı ayrı sıralanır; yeni
 * sayfa gelince yukarıdakiler yer değiştirmez.
 */
export type FeedSort = 'senin-icin' | 'en-yeni';
export const FEED_SORTS: readonly FeedSort[] = ['senin-icin', 'en-yeni'];

export interface RankItem {
  /** ISO tarih. */
  at: string;
  /** Kimin paylaşımı (aynı kişi arka arkaya gelmesin). */
  authorKey: string;
  likes?: number;
  comments?: number;
  reports?: number;
  /** Takip ettiğim kişi ya da işletme. */
  followed?: boolean;
  /** Kendi mahallemden. */
  nearby?: boolean;
  /** Resmî duyuru (muhtar, belediye, kurum): etkileşim beklemeden yerini korur. */
  official?: boolean;
}

export const FEED_RANK = {
  /** Puanın yarıya indiği süre (saat). */
  halfLifeHours: 18,
  commentWeight: 3,
  followedBoost: 1.6,
  nearbyBoost: 1.3,
  officialBoost: 2,
  /** İlk saatte yeni paylaşıma ilk gösterim şansı (takipçisi olmayan da görünsün). */
  freshBoost: 2.2,
  /** Her şikâyet puanı yarıya indirir. */
  reportPenalty: 0.5,
} as const;

export function rankScore(x: RankItem, now: number): number {
  const hours = Math.max(0, (now - new Date(x.at).getTime()) / 3_600_000);
  // Etkileşim azalan getiriyle: 100 beğeni 10 beğeninin 10 katı değil (birkaç popüler paylaşım akışı ele geçirmesin).
  const engagement = Math.log2(2 + (x.likes ?? 0) + FEED_RANK.commentWeight * (x.comments ?? 0));
  let score = engagement * Math.pow(0.5, hours / FEED_RANK.halfLifeHours);
  if (x.followed) score *= FEED_RANK.followedBoost;
  if (x.nearby) score *= FEED_RANK.nearbyBoost;
  if (x.official) score *= FEED_RANK.officialBoost;
  if (hours < 1) score *= FEED_RANK.freshBoost;
  if (x.reports) score *= Math.pow(FEED_RANK.reportPenalty, x.reports);
  return score;
}

/** Çeşitlilik: aynı kişinin paylaşımı bir öncekinin hemen ardından gelmez (başka paylaşım varsa araya girer). */
export function spreadAuthors<T>(sorted: T[], key: (x: T) => string): T[] {
  const rest = [...sorted];
  const out: T[] = [];
  while (rest.length) {
    const prev = out.length ? key(out[out.length - 1]) : null;
    const i = rest.findIndex((x) => key(x) !== prev);
    out.push(...rest.splice(i < 0 ? 0 : i, 1));
  }
  return out;
}

/**
 * Bir sayfayı "Senin için" sırasına koyar. Girdi zaman sırasında gelir; `chunk` kadarlık bloklar kendi içinde sıralanır
 * (sayfalama kararlı kalır). "En yeni" için çağrılmaz.
 */
export function rankFeed<T>(items: T[], toRank: (x: T) => RankItem, now: number, chunk = 20): T[] {
  const out: T[] = [];
  for (let i = 0; i < items.length; i += chunk) {
    const block = items.slice(i, i + chunk).map((x) => ({ x, r: toRank(x) }));
    block.sort((a, b) => rankScore(b.r, now) - rankScore(a.r, now) || b.r.at.localeCompare(a.r.at));
    out.push(...spreadAuthors(block, (b) => b.r.authorKey).map((b) => b.x));
  }
  return out;
}
