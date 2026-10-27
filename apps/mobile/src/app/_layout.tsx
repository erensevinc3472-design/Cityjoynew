import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { LocaleProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/lib/i18n';
import { IncomingSosBanner, IncomingSosProvider, PushRegistrar } from '@/lib/incoming-sos';
// SOS arka plan konum görevi, uygulama kapalıyken de çalışabilmesi için en başta tanımlanır.
import '@/lib/sos-background';
import { SessionProvider, useSession } from '@/lib/session';
import { SettingsProvider, useSettings } from '@/lib/settings';
import { useThemeColors } from '@/theme/use-theme';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { ready, rtl } = useSettings();
  const session = useSession();
  const c = useThemeColors();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  // Yazı tipi yüklenemezse sistem yazı tipiyle devam edilir.
  const loaded = ready && session.ready && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <LocaleProvider direction={rtl ? 'rtl' : 'ltr'}>
      <View style={{ flex: 1, direction: rtl ? 'rtl' : 'ltr', backgroundColor: c.background }}>
        <IncomingSosProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }} />
          <IncomingSosBanner />
          <PushRegistrar />
        </IncomingSosProvider>
      </View>
    </LocaleProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <SessionProvider>
          <RootNavigator />
        </SessionProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
