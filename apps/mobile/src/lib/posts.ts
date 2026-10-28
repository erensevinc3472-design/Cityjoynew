import { useCallback, useEffect, useState } from 'react';
import { isPostListed, type Post } from '@cityjoy/shared';
import type { FeedFilter } from '@cityjoy/shared/firebase';

import { postRepository } from './services';

const keyOf = (f: FeedFilter) =>
  f.target === 'mahallem' ? `m:${f.neighbourhoodId}` : f.target === 'bolgesel' ? `b:${f.provinceCode}:${f.districtId ?? ''}` : 'g';

/** Sekme başına okunan sayfalar; sekmeler arası geçişte yeniden okunmaz, 5 dakikada bir tazelenir (maliyet ilkesi). */
const cache = new Map<string, { at: number; posts: Post[]; cursor: string | null }>();
const TTL = 5 * 60 * 1000;

/** Keşfet akışı: ilk sayfa, aşağı kaydırdıkça sonraki sayfa, aşağı çekince yenileme. Şikâyetle düşenler görünmez. */
export function useFeed(filter: FeedFilter | null) {
  const key = filter ? keyOf(filter) : null;
  const [state, setState] = useState(() => (key ? cache.get(key) : undefined));
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (force = false) => {
      if (!filter || !key) return setState({ at: 0, posts: [], cursor: null });
      const hit = cache.get(key);
      if (hit && !force && Date.now() - hit.at < TTL) return setState(hit);
      if (force || !hit) setState(hit);
      setFailed(false);
      try {
        const page = await postRepository.feed(filter);
        const entry = { at: Date.now(), ...page };
        cache.set(key, entry);
        setState(entry);
      } catch {
        setFailed(true);
        setState((s) => s ?? { at: 0, posts: [], cursor: null });
      }
    },
    // Süzgeç anahtarıyla aynıdır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Yeni gönderiden sonra açık akış da yeniden okunsun (geri dönünce gönderi görünsün).
  useEffect(() => {
    const l = () => load();
    feedListeners.add(l);
    return () => {
      feedListeners.delete(l);
    };
  }, [load]);

  const loadMore = async () => {
    const cur = key ? cache.get(key) : undefined;
    if (!filter || !key || !cur?.cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await postRepository.feed(filter, cur.cursor);
      const seen = new Set(cur.posts.map((p) => p.id));
      const entry = { at: cur.at, posts: [...cur.posts, ...page.posts.filter((p) => !seen.has(p.id))], cursor: page.cursor };
      cache.set(key, entry);
      setState(entry);
    } catch {
      setFailed(true);
    } finally {
      setLoadingMore(false);
    }
  };

  return {
    posts: state ? state.posts.filter(isPostListed) : null,
    hasMore: !!state?.cursor,
    failed,
    loadingMore,
    reload: () => load(true),
    loadMore,
  };
}

export function cachedPost(id: string): Post | undefined {
  for (const { posts } of cache.values()) {
    const p = posts.find((x) => x.id === id);
    if (p) return p;
  }
  return undefined;
}

/** Beğeni, kaldırma sonrası akış yeniden okunmadan doğru görünsün. */
export function patchCachedPost(id: string, patch: Partial<Post>) {
  for (const entry of cache.values()) entry.posts = entry.posts.map((p) => (p.id === id ? { ...p, ...patch } : p));
}

const feedListeners = new Set<() => void>();

/** Yeni gönderi hemen görünsün: önbellek boşalır, açık akışlar yeniden okunur. */
export function forgetFeeds() {
  cache.clear();
  feedListeners.forEach((f) => f());
}

/** Kişinin beğendikleri: oturum başına tek sorgu, sonra yerelde güncellenir. */
let liked: { uid: string; ids: Set<string> } | null = null;
const listeners = new Set<() => void>();

export function useLiked(uid: string | undefined) {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    if (uid && liked?.uid !== uid) {
      liked = { uid, ids: new Set() };
      postRepository.likedIds(uid).then((ids) => {
        if (liked?.uid === uid) liked.ids = ids;
        listeners.forEach((f) => f());
      }, () => {});
    }
    return () => {
      listeners.delete(l);
    };
  }, [uid]);
  return (id: string) => (!!uid && liked?.uid === uid && liked.ids.has(id));
}

/** Beğen / geri al: veritabanı, önbellek ve kalpler birlikte. Döner: yeni sayı. */
export async function toggleLike(post: Pick<Post, 'id' | 'likeCount'>, uid: string, isLiked: boolean): Promise<number> {
  if (isLiked) await postRepository.unlike(post.id, uid);
  else await postRepository.like(post.id, uid);
  if (liked?.uid === uid) {
    if (isLiked) liked.ids.delete(post.id);
    else liked.ids.add(post.id);
  }
  const count = Math.max(0, post.likeCount + (isLiked ? -1 : 1));
  patchCachedPost(post.id, { likeCount: count });
  listeners.forEach((f) => f());
  return count;
}
