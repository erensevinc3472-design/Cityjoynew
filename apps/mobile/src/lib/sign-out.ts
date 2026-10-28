import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { restartFlow } from './navigation';
import { unregisterPush } from './push';
import { authService } from './services';
import { useSession } from './session';

/** Çıkış: bu telefonun anlık bildirim kaydı silinir (aile SOS'u gelmesin), oturum kapanır, akış baştan başlar. */
export function useSignOut() {
  const router = useRouter();
  const { user, adopt } = useSession();
  return useCallback(async () => {
    if (user) await unregisterPush(user.uid);
    await authService.signOut();
    await adopt(null);
    restartFlow(router);
  }, [router, user, adopt]);
}
