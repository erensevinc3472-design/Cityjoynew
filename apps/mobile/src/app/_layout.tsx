import { Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { LocaleProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CrashScreen } from '@/components/crash-screen';
import { OfflineBanner } from '@/components/offline-banner';
import '@/lib/i18n';
import { IncomingSosBanner, IncomingSosProvider, PushRegistrar } from '@/lib/incoming-sos';
// SOS arka plan konum görevi, uygulama kapalıyken de çalışabilmesi için en başta tanımlanır.
import '@/lib/sos-background';
import { ReturnToExplore } from '@/lib/return-to-explore';
import { SessionProvider, useSession } from '@/lib/session';
import { SettingsProvider, useSettings } from '@/lib/settings';
import { useThemeColors } from '@/theme/use-theme';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { ready, rtl } = useSettings();
  const session = useSession();
  const c = useThemeColors();
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  // Yazı tipi yüklenemezse sistem yazı tipiyle devam edilir.
  const loaded = ready && session.ready && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <LocaleProvider direction={rtl ? 'rtl' : 'ltr'}>
      {/* Web bu stili tanımaz; orada yönü LocaleProvider ve dir verir. */}
      <View style={{ flex: 1, ...(Platform.OS === 'web' ? {} : { direction: rtl ? ('rtl' as const) : ('ltr' as const) }), backgroundColor: c.background }}>
        <IncomingSosProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }} />
          <IncomingSosBanner />
          <OfflineBanner />
          <PushRegistrar />
          <ReturnToExplore />
        </IncomingSosProvider>
      </View>
    </LocaleProvider>
  );
}

/** Herhangi bir ekran çökerse uygulama beyaz ekranda kalmaz, "Bir sorun oldu, tekrar dene" gösterilir. */
export const ErrorBoundary = CrashScreen;

export default function RootLayout() {
  return (
    // İç içe kaydırmalar (Keşfet sekmeleri içinde fotoğraflar) için hareket kütüphanesinin kökü.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SettingsProvider>
          <SessionProvider>
            <RootNavigator />
          </SessionProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
