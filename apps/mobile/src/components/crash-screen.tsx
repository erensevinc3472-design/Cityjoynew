import { MaterialIcons } from '@expo/vector-icons';
import type { ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import i18n from '@/lib/i18n';
import { colors, fonts, MIN_TOUCH, radius, spacing } from '@/theme/tokens';

/**
 * Uygulama çökünce gösterilen "Bir sorun oldu" ekranı (kök hata yakalayıcı, mağaza öncesi liste).
 * Hata ayar ya da oturum katmanında da olabileceği için onlara bağlanmaz: renk telefonun ayarından,
 * metin i18n'in o anki dilinden gelir.
 */
export function CrashScreen({ error, retry }: ErrorBoundaryProps) {
  const c = colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const t = i18n.t.bind(i18n);
  const rtl = i18n.dir() === 'rtl';

  useEffect(() => {
    // Açılışta çökerse açılış görseli kalkmadan ekran gizli kalmasın.
    SplashScreen.hideAsync().catch(() => {});
    // Çökme raporu (Sentry/Crashlytics) EAS derlemesiyle eklenecek; şimdilik geliştirici konsoluna yazılır.
    console.error(error);
  }, [error]);

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.background }]}>
      <View style={[styles.box, { direction: rtl ? 'rtl' : 'ltr' }]} accessibilityLiveRegion="assertive">
        <View style={[styles.icon, { backgroundColor: c.dangerSoft }]}>
          <MaterialIcons name="error-outline" size={36} color={c.danger} />
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: c.textStrong }]}>
          {t('common.crashTitle')}
        </Text>
        <Text style={[styles.body, { color: c.textMuted }]}>{t('common.crashBody')}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={retry}
          style={({ pressed }) => [styles.button, { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 }]}>
          <Text style={[styles.buttonLabel, { color: c.onPrimary }]}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, maxWidth: 480, alignSelf: 'center' },
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.heading, fontSize: 22, textAlign: 'center' },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  button: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  buttonLabel: { fontFamily: fonts.headingSemi, fontSize: 16 },
});
