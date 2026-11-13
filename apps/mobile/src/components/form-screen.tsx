import { useRouter } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { spacing } from '@/theme/tokens';
import { AppText } from './app-text';
import { HeroHeader } from './hero-header';
import { Screen } from './screen';

/** Üst bantta başlık ve geri düğmesi, altında klavyeyle kayan form: giriş, kayıt, profil, hesap. */
export function FormScreen({ title, subtitle, showBack = true, footer, children }: PropsWithChildren<{ title: string; subtitle?: string; showBack?: boolean; footer?: ReactNode }>) {
  const router = useRouter();
  const canBack = showBack && router.canGoBack();
  return (
    <Screen header={<HeroHeader title={title} onBack={canBack ? () => router.back() : undefined} />} footer={footer}>
      {/* iPhone: klavye açılınca kaydırma alanı klavyenin gerçek yerine göre boşluk bırakır, odaktaki kutu görünür kalır
          (KeyboardAvoidingView üstteki başlığı hesaba katmadığı için kutular klavyenin altında kalabiliyordu). */}
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets>
        {subtitle ? <AppText muted>{subtitle}</AppText> : null}
        {children}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: spacing.md, paddingBottom: spacing.xl },
});
