import { useEffect, useState } from 'react';
import type { Post } from '@cityjoy/shared';

import { deviceStorage } from './storage';

/**
 * Son gördüklerin (Kaydettiklerim > Son gördüklerin): kişinin baktığı son 10 gönderi (Eren, 13 Kasım 2026: "insanlar
 * gördüğünü kaybetmeden tekrar bulmak istiyor"). Yalnızca telefonda, hesaba özel anahtarla tutulur; sunucuya hiçbir şey
 * yazılmaz, okuma maliyeti yoktur. "Gördü" sayılan: gönderi ayrıntısını açmak, videoyu açmak ya da Keşfet akışında
 * gönderide birkaç saniye durmak. "Sıfırla" listeyi siler.
 */
export const RECENT_POSTS_MAX = 10;
const key = (uid: string) => `cj.recentPosts.${uid}`;

const memory = new Map<string, Post[]>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function load(uid: string): Promise<Post[]> {
  const hit = memory.get(uid);
  if (hit) return hit;
  let list: Post[] = [];
  try {
    const raw = await deviceStorage.get(key(uid));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) list = (parsed as Post[]).filter((p) => p && typeof p.id === 'string').slice(0, RECENT_POSTS_MAX);
  } catch {}
  if (!memory.has(uid)) memory.set(uid, list);
  return memory.get(uid)!;
}

/** Gönderiyi listenin başına koyar (zaten varsa öne alır). */
export async function markSeen(uid: string, post: Post): Promise<void> {
  const list = await load(uid);
  if (list[0]?.id === post.id) return;
  const next = [post, ...list.filter((p) => p.id !== post.id)].slice(0, RECENT_POSTS_MAX);
  memory.set(uid, next);
  emit();
  await deviceStorage.set(key(uid), JSON.stringify(next));
}

/** Listeyi siler ("Sıfırla" ve hesap silme). */
export async function clearRecent(uid: string): Promise<void> {
  memory.set(uid, []);
  emit();
  await deviceStorage.remove(key(uid));
}

/** Son gördüklerin listesi (yeniden eskiye); yüklenirken null. */
export function useRecentPosts(uid: string | undefined): Post[] | null {
  const [list, setList] = useState<Post[] | null>(() => (uid ? memory.get(uid) ?? null : null));
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    const sync = () => {
      const m = memory.get(uid);
      if (m && alive) setList(m);
    };
    listeners.add(sync);
    load(uid).then((l) => alive && setList(l));
    return () => {
      alive = false;
      listeners.delete(sync);
    };
  }, [uid]);
  return list;
}
