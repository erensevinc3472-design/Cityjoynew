import { Redirect } from 'expo-router';
import { isProfileComplete } from '@cityjoy/shared';

import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { isFirebaseConfigured } from '@/lib/firebase-config';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';

/**
 * Açılış yönlendirmesi (PROJE.md 3.1): dil > giriş/kayıt > ek bilgiler > konum > ana sayfa.
 * Konum zorunlu değildir; atlanabilir.
 */
export default function Index() {
  const { language } = useSettings();
  const { user, profile, profileError, refreshProfile } = useSession();
  const { stepDone } = useUserLocation();

  if (!language) return <Redirect href="/language" />;
  if (isFirebaseConfigured && !user) return <Redirect href="/welcome" />;
  if (user && profileError) {
    return (
      <Screen>
        <StateMessage kind="error" onRetry={refreshProfile} />
      </Screen>
    );
  }
  if (user && (!profile || !isProfileComplete(profile))) return <Redirect href="/complete-profile" />;
  if (!stepDone) return <Redirect href="/location" />;
  return <Redirect href="/home" />;
}
