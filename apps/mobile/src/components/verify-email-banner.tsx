import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { authService } from '@/lib/services';
import { useSession } from '@/lib/session';
import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppButton } from './app-button';
import { AppText } from './app-text';

/** E-posta doğrulanana kadar ana sayfada görünür; uygulamayı kullanmayı engellemez. */
export function VerifyEmailBanner() {
  const { t } = useTranslation();
  const c = useThemeColors();
  const { user, refreshUser } = useSession();
  const [note, setNote] = useState<string>();
  if (!user || user.emailVerified || !user.email) return null;

  const resend = async () => {
    try {
      await authService.sendEmailVerification();
      setNote(t('verify.sent'));
    } catch {
      setNote(t('errors.tooManyRequests'));
    }
  };
  const check = async () => {
    await refreshUser();
    setNote(t('verify.stillNot'));
  };

  return (
    <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.accentBorder }]} accessibilityLiveRegion="polite">
      <AppText>{t('verify.banner', { email: user.email })}</AppText>
      {note ? <AppText variant="caption" muted>{note}</AppText> : null}
      <View style={styles.row}>
        <View style={styles.flex}><AppButton variant="primary" title={t('verify.done')} onPress={check} /></View>
        <View style={styles.flex}><AppButton variant="ghost" title={t('verify.resend')} onPress={resend} /></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
