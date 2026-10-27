import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { notificationPermission, pushSupported, registerForPush } from '@/lib/push';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { backgroundPermission, requestBackgroundPermission } from '@/lib/sos-background';
import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppButton } from './app-button';
import { AppText } from './app-text';

type Perm = 'granted' | 'denied' | 'undetermined' | 'unsupported';

/**
 * SOS hazırlığı: acil anda vakit kaybetmemek için bildirim ve "her zaman" konum izni önceden alınır.
 * İzin reddedildiyse telefon ayarlarına yönlendirir.
 */
export function SosReadiness() {
  const { t } = useTranslation();
  const c = useThemeColors();
  const { user } = useSession();
  const { language } = useSettings();
  const [notify, setNotify] = useState<Perm>('undetermined');
  const [bg, setBg] = useState<Perm>('undetermined');

  const check = useCallback(() => {
    notificationPermission().then(setNotify);
    backgroundPermission().then(setBg);
  }, []);
  useFocusEffect(check);

  if (!pushSupported) {
    return (
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <AppText variant="label">{t('sos.readyTitle')}</AppText>
        <AppText variant="caption" muted>{t('sos.readyPhoneOnly')}</AppText>
      </View>
    );
  }

  const row = (label: string, state: Perm, ask: () => Promise<Perm>) => (
    <View style={styles.row}>
      <MaterialIcons name={state === 'granted' ? 'check-circle' : 'error-outline'} size={22} color={state === 'granted' ? c.success : c.danger} />
      <View style={styles.flex}>
        <AppText variant="caption" style={{ color: c.textStrong }}>{label}</AppText>
        <AppText variant="caption" style={{ color: state === 'granted' ? c.success : c.danger }}>
          {state === 'granted' ? t('sos.readyOk') : t('sos.readyMissing')}
        </AppText>
      </View>
      {state === 'granted' ? null : state === 'denied' ? (
        <AppButton variant="secondary" title={t('sos.readySettings')} onPress={() => Linking.openSettings().catch(() => {})} />
      ) : (
        <AppButton variant="secondary" title={t('sos.readyGrant')} onPress={() => ask().then(check)} />
      )}
    </View>
  );

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: notify === 'granted' && bg === 'granted' ? c.border : c.danger }]}>
      <AppText variant="label" accessibilityRole="header">{t('sos.readyTitle')}</AppText>
      <AppText variant="caption" muted>{t('sos.readyIntro')}</AppText>
      {row(t('sos.readyNotify'), notify, async () => (user ? registerForPush(user.uid, language ?? 'tr', true) : 'undetermined'))}
      {row(t('sos.readyBackground'), bg, requestBackgroundPermission)}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1, gap: 2 },
});
