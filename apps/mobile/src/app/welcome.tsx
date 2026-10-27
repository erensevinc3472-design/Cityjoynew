import { Redirect, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { HeroHeader } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { useSession } from '@/lib/session';
import { spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { user } = useSession();
  // Giriş yapmış kullanıcı karşılama ekranında kalmaz.
  if (user) return <Redirect href="/" />;
  return (
    <Screen
      header={
        <HeroHeader title="CityJoy">
          <View style={styles.hero}>
            <AppText variant="title" style={{ color: c.heroText }}>{t('auth.welcomeTitle')}</AppText>
            <AppText style={{ color: c.heroMuted }}>{t('auth.welcomeSubtitle')}</AppText>
          </View>
        </HeroHeader>
      }>
      <View style={styles.flex} />
      <View style={styles.actions}>
        <AppButton title={t('auth.signUp')} onPress={() => router.push('/sign-up')} />
        <AppButton variant="secondary" title={t('auth.signIn')} onPress={() => router.push('/sign-in')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm, paddingTop: spacing.lg, paddingBottom: spacing.md },
  flex: { flex: 1 },
  actions: { gap: spacing.sm, paddingBottom: spacing.lg },
});
