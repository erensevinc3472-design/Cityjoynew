import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useSettings } from '@/lib/settings';
import { MIN_TOUCH, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';
import { Screen } from './screen';

/** Başlık, geri düğmesi ve klavyeyle kayan içerik: giriş, kayıt ve profil formları için. */
export function FormScreen({ title, subtitle, showBack = true, children }: PropsWithChildren<{ title: string; subtitle?: string; showBack?: boolean }>) {
  const router = useRouter();
  const c = useThemeColors();
  const { rtl } = useSettings();
  const { t } = useTranslation();
  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {showBack && router.canGoBack() ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.back} hitSlop={8}>
              <MaterialIcons name={rtl ? 'arrow-forward' : 'arrow-back'} size={24} color={c.text} />
            </Pressable>
          ) : null}
          <View style={styles.header}>
            <AppText variant="title">{title}</AppText>
            {subtitle ? <AppText muted>{subtitle}</AppText> : null}
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  back: { width: MIN_TOUCH, height: MIN_TOUCH, justifyContent: 'center', marginStart: -spacing.xs },
  header: { gap: spacing.xs, paddingBottom: spacing.sm },
});
