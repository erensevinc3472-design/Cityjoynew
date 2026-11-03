import { Redirect } from 'expo-router';
import { isProfileComplete } from '@cityjoy/shared';

import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { isFirebaseConfigured } from '@/lib/firebase-config';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';

/**
 * Açılış yönlendirmesi (13. madde 35, giriş akışı): karşılama > dil > giriş/kayıt > konum izni ve mahalle > bildirim izni
 * (isteğe bağlı meslek, cinsiyet ve onaylar) > ana sayfa. Konum zorunlu değildir; atlanabilir.
 */
export default function Index() {
  const { language } = useSettings();
  const { user, profile, profileError, refreshProfile } = useSession();
  const { stepDone } = useUserLocation();

  if (isFirebaseConfigured && !user) return <Redirect href="/welcome" />;
  if (!language) return <Redirect href="/language" />;
  if (user && profileError) {
    return (
      <Screen>
        <StateMessage kind="error" onRetry={refreshProfile} />
      </Screen>
    );
  }
  // Google ile ilk girişte profil yoktur: doğum yılı ve onaylar bildirim ekranında alınır, konumdan önce.
  if (user && !profile) return <Redirect href="/complete-profile" />;
  if (!stepDone) return <Redirect href="/permission-location" />;
  if (user && profile && !isProfileComplete(profile)) return <Redirect href="/complete-profile" />;
  return <Redirect href="/home" />;
}
