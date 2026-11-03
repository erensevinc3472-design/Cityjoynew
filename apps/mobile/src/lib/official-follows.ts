import { useCallback, useEffect, useState } from 'react';

import { officialFollowRepository } from './services';
import { useSession } from './session';

/** Resmî profil takibi: takip kaydı ve sayaç birlikte yazılır (kurallar kayıtlı konumu ve yaşı denetler). */
export function useOfficialFollow(profileId: string | undefined) {
  const { user, profile } = useSession();
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user || !profileId) return setFollowing(null);
    let live = true;
    officialFollowRepository.isFollowing(profileId, user.uid).then(
      (f) => live && setFollowing(f),
      () => live && setFollowing(null),
    );
    return () => {
      live = false;
    };
  }, [user, profileId]);

  const toggle = useCallback(async () => {
    if (!user || !profile || !profileId || following === null) return;
    setBusy(true);
    setError(false);
    try {
      if (following) await officialFollowRepository.unfollow(profileId, user.uid);
      else await officialFollowRepository.follow(profileId, profile);
      setFollowing(!following);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }, [user, profile, profileId, following]);

  return { canFollow: !!user && !!profile && following !== null, following: !!following, busy, error, toggle };
}
