import { useEffect, useState } from 'react';
import { authorNameOf, type PublicProfile } from '@cityjoy/shared';

import { socialRepository } from './services';
import { useSession } from './session';

/**
 * Oturum başına bir kez okunan Keşfet bilgileri: kendi herkese açık profilim (yoksa açılır), engellediklerim ve takip
 * ettiklerim. Değişince yerelde güncellenir; akışlar bunlara göre süzülür.
 */
let state: { uid: string; profile: PublicProfile | null; blocked: Set<string>; following: string[] | null } | null = null;
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
    state = { uid, profile: null, blocked: new Set(), following: null };
    socialRepository.ensureProfile(uid, authorNameOf(profile.displayName), profile.isPrivate).then((p) => {
      if (state?.uid === uid) state.profile = p;
      notify();
    }, () => {});
    socialRepository.myBlocks(uid).then((b) => {
      if (state?.uid === uid) state.blocked = b;
      notify();
    }, () => {});
    refreshFollowing(uid);
  }, [uid, profile]);

  const mine = uid && state?.uid === uid ? state : null;
  return {
    me: mine?.profile ?? null,
    blocked: mine?.blocked ?? new Set<string>(),
    /** null: henüz okunmadı. */
    following: mine?.following ?? null,
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
