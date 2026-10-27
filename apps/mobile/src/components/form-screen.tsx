import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { spacing } from '@/theme/tokens';
import { AppText } from './app-text';
import { HeroHeader } from './hero-header';
import { Screen } from './screen';

/** Üst bantta başlık ve geri düğmesi, altında klavyeyle kayan form: giriş, kayıt, profil, hesap. */
export function FormScreen({ title, subtitle, showBack = true, children }: PropsWithChildren<{ title: string; subtitle?: string; showBack?: boolean }>) {
  const router = useRouter();
  const canBack = showBack && router.canGoBack();
  return (
    <Screen header={<HeroHeader title={title} onBack={canBack ? () => router.back() : undefined} />}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {subtitle ? <AppText muted>{subtitle}</AppText> : null}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: spacing.md, paddingBottom: spacing.xl },
});
