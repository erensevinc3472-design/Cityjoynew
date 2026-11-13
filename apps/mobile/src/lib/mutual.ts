import type { PublicProfile } from '@cityjoy/shared';

import { socialRepository } from './services';

export interface Mutual {
  uids: string[];
  top: PublicProfile[];
}

/**
 * Ortak takipçiler (maliyet ilkesi, Eren 13 Kasım 2026): aynı profil gün içinde yeniden açılınca veritabanı okunmaz.
 * Sonuç uygulama açıkken bir gün saklanır; takip listem değişince (takip et / bırak) yeniden hesaplanır.
 */
const DAY_MS = 86_400_000;
const cache = new Map<string, { at: number; key: string; value: Mutual | null }>();

export async function loadMutual(me: string, other: string, following: readonly string[]): Promise<Mutual | null> {
  const id = `${me}>${other}`;
  const key = following.length + ':' + following.slice(0, 5).join(',');
  const hit = cache.get(id);
  if (hit && hit.key === key && Date.now() - hit.at < DAY_MS) return hit.value;
  const uids = following.length ? await socialRepository.mutualFollowers(following, other) : [];
  const value = uids.length ? { uids, top: await socialRepository.profilesOf(uids.slice(0, 3)) } : null;
  if (cache.size > 300) cache.clear();
  cache.set(id, { at: Date.now(), key, value });
  return value;
}
