import { useEffect, useState } from 'react';
import { authorNameOf, type PublicProfile } from '@cityjoy/shared';

import { businessRepository, socialRepository } from './services';
import { useSession } from './session';

/**
 * Oturum başına bir kez okunan Keşfet bilgileri: kendi herkese açık profilim (yoksa açılır), engellediklerim ve takip
 * ettiklerim. Değişince yerelde güncellenir; akışlar bunlara göre süzülür.
 */
let state: { uid: string; profile: PublicProfile | null; blocked: Set<string>; following: string[] | null; businesses: string[] | null } | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

export function useSocial() {
  const { user, profile } = useSession();
  const [, force] = useState(0);
  const uid = user?.uid;

  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  useEffect(() => {
    if (!uid || !profile || state?.uid === uid) return;
    state = { uid, profile: null, blocked: new Set(), following: null, businesses: null };
    socialRepository.ensureProfile(uid, authorNameOf(profile.displayName), profile.isPrivate).then((p) => {
      if (state?.uid === uid) state.profile = p;
      notify();
    }, () => {});
    socialRepository.myBlocks(uid).then((b) => {
      if (state?.uid === uid) state.blocked = b;
      notify();
    }, () => {});
    refreshFollowing(uid);
    businessRepository.followedIds(uid).then((b) => {
      if (state?.uid === uid) state.businesses = b;
      notify();
    }, () => {
      if (state?.uid === uid) state.businesses = [];
      notify();
    });
  }, [uid, profile]);

  const mine = uid && state?.uid === uid ? state : null;
  return {
    me: mine?.profile ?? null,
    blocked: mine?.blocked ?? new Set<string>(),
    /** null: henüz okunmadı. */
    following: mine?.following ?? null,
    /** Takip ettiğim işletmeler; null: henüz okunmadı. */
    followingBusinesses: mine?.businesses ?? null,
  };
}

export function refreshFollowing(uid: string) {
  socialRepository.followingUids(uid).then((f) => {
    if (state?.uid === uid) state.following = f;
    notify();
  }, () => {
    if (state?.uid === uid) state.following = [];
    notify();
  });
}

export function setMyProfile(p: PublicProfile) {
  if (state?.uid === p.uid) state.profile = p;
  notify();
}

export function setBlocked(uid: string, other: string, blocked: boolean) {
  if (state?.uid !== uid) return;
  if (blocked) {
    state.blocked.add(other);
    if (state.following) state.following = state.following.filter((x) => x !== other);
  } else state.blocked.delete(other);
  notify();
}

/**
 * Akıştan takip et / bırak. Gizli hesapta istek gider (profil okunup anlaşılır). Döner: yeni durum.
 * Takip listesi yerelde hemen güncellenir; Takip akışı bir sonraki açılışta yenilenir.
 */
export async function toggleFollowAuthor(me: string, other: string, following: boolean): Promise<'aktif' | 'istek' | null> {
  if (following) {
    await socialRepository.unfollow(me, other);
    if (state?.uid === me && state.following) state.following = state.following.filter((x) => x !== other);
    notify();
    return null;
  }
  const profile = await socialRepository.getProfile(other);
  const status = await socialRepository.follow(me, other, profile?.isPrivate ?? false);
  if (status === 'aktif' && state?.uid === me) state.following = [...(state.following ?? []), other];
  notify();
  return status;
}

/** İşletmeyi takip et / bırak (işletme sayfası ve akış). Takip listesi yerelde hemen güncellenir. */
export async function toggleFollowBusiness(me: string, bid: string, following: boolean): Promise<boolean> {
  if (following) await businessRepository.unfollow(bid, me);
  else await businessRepository.follow(bid, me);
  if (state?.uid === me) {
    const list = state.businesses ?? [];
    state.businesses = following ? list.filter((x) => x !== bid) : [...list, bid];
  }
  notify();
  return !following;
}
