import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { isProfileComplete } from '@cityjoy/shared';

import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { isFirebaseConfigured } from '@/lib/firebase-config';
import { consumeRestoredStart, startsWithRestoredSession, useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';

/**
 * Açılış yönlendirmesi (13. madde 35, giriş akışı): karşılama > dil > giriş/kayıt > konum izni ve mahalle > bildirim izni
 * (isteğe bağlı meslek, cinsiyet ve onaylar) > ana sayfa. Konum zorunlu değildir; atlanabilir.
 * Oturum telefonda zaten açıkken uygulama yeniden başlatılınca Keşfet açılır (Eren, 12 Kasım 2026: "insanların en çok
 * kullanacağı yer"); kayıt ya da girişten hemen sonra ana sayfa.
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
  return <StartRedirect />;
}

function StartRedirect() {
  const [explore] = useState(startsWithRestoredSession);
  useEffect(() => {
    if (explore) consumeRestoredStart();
  }, [explore]);
  return <Redirect href={explore ? '/explore' : '/home'} />;
}
