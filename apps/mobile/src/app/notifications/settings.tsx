import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CRITICAL_CATEGORIES, NOTIFICATION_CATEGORIES, type NotificationCategory, type NotificationPrefs } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { CheckboxRow } from '@/components/checkbox-row';
import { FormMessage } from '@/components/form-message';
import { HeroHeader } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useNotificationPrefs } from '@/lib/notifications';
import { MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Bildirim ayarları (PROJE.md 5.12): tür başına aç/kapa ve sessiz saatler. Acil kamu duyurusu ve SOS varsayılan açık;
 * kapatmak isteyen kişi önce uyarıyı görür ve onaylar. Tercihler kişinin özel belgesine yazılır (telefona bildirim
 * geldiğinde de kullanılır).
 */
export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { prefs, triggers, ready, save } = useNotificationPrefs();
  const [confirm, setConfirm] = useState<NotificationCategory | null>(null);
  const [error, setError] = useState<string>();

  const apply = (next: NotificationPrefs) => {
    setError(undefined);
    save(next).catch(() => setError(t('notifications.saveError')));
  };
  const toggle = (cat: NotificationCategory) => {
    const on = prefs.categories[cat];
    // Kritik türü kapatmadan önce uyarı (PROJE.md 5.12).
    if (on && CRITICAL_CATEGORIES.includes(cat) && confirm !== cat) return setConfirm(cat);
    setConfirm(null);
    apply({ ...prefs, categories: { ...prefs.categories, [cat]: !on } });
  };
  const q = prefs.quietHours;
  const setHour = (key: 'start' | 'end', delta: number) => apply({ ...prefs, quietHours: { ...q, [key]: (q[key] + delta + 24) % 24 } });
  const hour = (h: number) => `${String(h).padStart(2, '0')}:00`;

  const header = <HeroHeader title={t('notifications.settings')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/notifications'))} />;

  if (!ready) return <Screen header={header}><StateMessage kind="loading" /></Screen>;

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="label" accessibilityRole="header">{t('notifications.typesTitle')}</AppText>
        {NOTIFICATION_CATEGORIES.map((cat) => (
          <View key={cat} style={styles.group}>
            <CheckboxRow checked={prefs.categories[cat] && triggers[cat]} onToggle={() => triggers[cat] && toggle(cat)} label={t(`notifications.categories.${cat}`)} />
            <AppText variant="caption" muted>{t(`notifications.hints.${cat}`)}</AppText>
            {!triggers[cat] ? <AppText variant="caption" muted>{t('notifications.offByCityJoy')}</AppText> : null}
            {confirm === cat ? (
              <View style={[styles.warn, { borderColor: c.danger, backgroundColor: c.dangerSoft }]}>
                <AppText>{t(`notifications.criticalWarning.${cat}`)}</AppText>
                <AppButton variant="secondary" title={t('notifications.keepOn')} onPress={() => setConfirm(null)} />
                <AppButton variant="ghost" title={t('notifications.turnOffAnyway')} onPress={() => toggle(cat)} />
              </View>
            ) : null}
            {CRITICAL_CATEGORIES.includes(cat) && !prefs.categories[cat] ? <FormMessage kind="error" text={t(`notifications.criticalOff.${cat}`)} /> : null}
          </View>
        ))}

        <AppText variant="label" accessibilityRole="header" style={styles.section}>{t('notifications.quietTitle')}</AppText>
        <CheckboxRow checked={q.enabled} onToggle={() => apply({ ...prefs, quietHours: { ...q, enabled: !q.enabled } })} label={t('notifications.quietOn')} />
        {q.enabled ? (
          <View style={styles.hours}>
            {(['start', 'end'] as const).map((key) => (
              <View key={key} style={styles.hourRow}>
                <AppText style={styles.grow}>{t(`notifications.quiet.${key}`)}</AppText>
                <Stepper label={t('notifications.earlier')} text="−" onPress={() => setHour(key, -1)} />
                <AppText variant="label" accessibilityLabel={`${t(`notifications.quiet.${key}`)} ${hour(q[key])}`} style={styles.hour}>{hour(q[key])}</AppText>
                <Stepper label={t('notifications.later')} text="+" onPress={() => setHour(key, 1)} />
              </View>
            ))}
          </View>
        ) : null}
        <AppText variant="caption" muted>{t('notifications.quietNote')}</AppText>
        {error ? <FormMessage kind="error" text={error} /> : null}
        <AppText variant="caption" muted>{t('notifications.pushNote')}</AppText>
      </ScrollView>
    </Screen>
  );
}

function Stepper({ label, text, onPress }: { label: string; text: string; onPress(): void }) {
  const c = useThemeColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.step, { borderColor: c.border, backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 }]}>
      <AppText variant="label">{text}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm, paddingBottom: spacing.xl },
  group: { gap: 2 },
  section: { marginTop: spacing.md },
  warn: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderRadius: radius.md, marginTop: spacing.xs },
  hours: { gap: spacing.sm },
  hourRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  hour: { minWidth: 56, textAlign: 'center' },
  step: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
