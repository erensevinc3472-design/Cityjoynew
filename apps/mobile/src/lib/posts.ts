import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { isPostListed, type Post } from '@cityjoy/shared';
import type { FeedFilter } from '@cityjoy/shared/firebase';

import { postRepository } from './services';

const keyOf = (f: FeedFilter) =>
  f.target === 'mahallem' ? `m:${f.neighbourhoodId}`
  : f.target === 'bolgesel' ? `b:${f.provinceCode}:${f.districtId ?? ''}`
  : f.target === 'takip' ? `t:${f.authorUids.join(',')}|${(f.businessIds ?? []).join(',')}`
  : 'g';

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

/**
 * Kişinin beğendikleri ve kaydettikleri: oturum başına tek sorgu, sonra yerelde güncellenir. Her değişiklikte yeni nesne
 * yazılır ve ekranlar useSyncExternalStore ile haber alır (React Compiler modül değişkenindeki değişikliği kendiliğinden
 * görmez; yoksa sayfa yenilenince kalpler boş kalabiliyordu). Açılışta okuma reddedilirse kısa süre sonra bir kez daha denenir.
 */
function idStore(read: (uid: string) => Promise<Set<string>>) {
  let state: { uid: string; ids: Set<string> } | null = null;
  const loading = new Set<string>();
  const listeners = new Set<() => void>();
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  };
  const snapshot = () => state;
  const publish = (next: { uid: string; ids: Set<string> }) => {
    state = next;
    listeners.forEach((l) => l());
  };
  const EMPTY = new Set<string>();

  return {
    use(uid: string | undefined) {
      const current = useSyncExternalStore(subscribe, snapshot, snapshot);
      useEffect(() => {
        let retry: ReturnType<typeof setTimeout> | undefined;
        const load = (again: boolean) => {
          if (!uid || state?.uid === uid || loading.has(uid)) return;
          loading.add(uid);
          read(uid).then(
            (ids) => {
              loading.delete(uid);
              publish({ uid, ids });
            },
            () => {
              loading.delete(uid);
              if (again) retry = setTimeout(() => load(false), 2000);
            },
          );
        };
        load(true);
        return () => {
          if (retry) clearTimeout(retry);
        };
      }, [uid]);
      const ids = uid && current?.uid === uid ? current.ids : EMPTY;
      return (id: string) => ids.has(id);
    },
    set(uid: string, id: string, on: boolean) {
      if (state?.uid !== uid) return;
      const next = new Set(state.ids);
      if (on) next.add(id);
      else next.delete(id);
      publish({ uid, ids: next });
    },
  };
}

const likedStore = idStore((uid) => postRepository.likedIds(uid));
const savedStore = idStore((uid) => postRepository.savedIds(uid));

export function useLiked(uid: string | undefined) {
  return likedStore.use(uid);
}

/** Beğen / geri al: veritabanı, önbellek ve kalpler birlikte. Döner: yeni sayı. */
export async function toggleLike(post: Pick<Post, 'id' | 'likeCount'>, uid: string, isLiked: boolean): Promise<number> {
  if (isLiked) await postRepository.unlike(post.id, uid);
  else await postRepository.like(post.id, uid);
  const count = Math.max(0, post.likeCount + (isLiked ? -1 : 1));
  patchCachedPost(post.id, { likeCount: count });
  likedStore.set(uid, post.id, !isLiked);
  return count;
}

/** Akıştaki kaydet işareti (Kaydettiklerim). */
export function useSaved(uid: string | undefined) {
  return savedStore.use(uid);
}

/** Kaydet / kaldır: veritabanı ve işaret birlikte. */
export async function toggleSave(postId: string, uid: string, isSaved: boolean): Promise<void> {
  if (isSaved) await postRepository.unsave(uid, postId);
  else await postRepository.save(uid, postId);
  savedStore.set(uid, postId, !isSaved);
}

/** Gönderiyi paylaşanın sayfası: işletme adına paylaşıldıysa işletme sayfası, değilse kişinin profili. */
export const authorHref = (p: Pick<Post, 'authorUid' | 'business'>) =>
  p.business ? ({ pathname: '/business/[id]', params: { id: p.business.id } } as const) : ({ pathname: '/u/[uid]', params: { uid: p.authorUid } } as const);
