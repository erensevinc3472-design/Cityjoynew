import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DEFAULT_SOS_CONFIG, telUrl, type FamilyMember, type SosConfig } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { FormMessage } from '@/components/form-message';
import { HeroHeader } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { SosReadiness } from '@/components/sos-readiness';
import { StateMessage } from '@/components/state-message';
import { currentLocation, type LocationState } from '@/lib/location';
import { goBackOr } from '@/lib/navigation';
import { sendSosPush } from '@/lib/push';
import { startBackgroundSharing } from '@/lib/sos-background';
import { familyRepository, sosRepository, SosSendTimeoutError } from '@/lib/services';
import { useSession } from '@/lib/session';
import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * SOS - Aileme haber ver (PROJE.md 5.4). SOS = "yardıma ihtiyacım var" (Eren). Tek düğme, tür seçimi yok.
 * Dokununca geri sayım başlar (yanlışlıkla basmaya karşı); sonra aile üyelerinin telefonuna yüksek
 * öncelikli bildirim gider ve konum, ekran kilitlense de arka planda paylaşılır.
 * Resmi acil çağrı değildir; 112 düğmesi her zaman üstte.
 */
export default function SosScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { user, profile } = useSession();

  const [members, setMembers] = useState<FamilyMember[] | null>(null);
  const [config, setConfig] = useState<SosConfig>(DEFAULT_SOS_CONFIG);
  const [loc, setLoc] = useState<LocationState>({ status: 'waiting' });
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const load = useCallback(() => {
    if (!user) return;
    familyRepository.listMembers(user.uid).then(setMembers).catch(() => setMembers([]));
  }, [user]);
  useFocusEffect(load);

  useEffect(() => {
    sosRepository.config().then(setConfig);
    currentLocation().then(setLoc);
    return () => clearInterval(timer.current);
  }, []);

  const send = useCallback(
    async (test: boolean) => {
      if (!user || !members?.length) return;
      setSending(true);
      setError(undefined);
      // Basıldığı andaki en taze konum; alınamazsa eldeki ya da konumsuz.
      const fresh = await Promise.race([currentLocation(), new Promise<LocationState>((r) => setTimeout(() => r(loc), 4000))]);
      const location = fresh.status === 'ready' ? fresh.location : loc.status === 'ready' ? loc.location : undefined;
      try {
        const fromName = profile?.displayName ?? user.displayName ?? '';
        const recipients = members.map((m) => m.uid);
        const id = await sosRepository.send({
          fromUid: user.uid,
          fromName,
          recipients,
          test,
          location,
          liveMinutes: config.liveMinutes,
        });
        const liveUntil = new Date(Date.now() + config.liveMinutes * 60_000).toISOString();
        // Arka planda konum (ekran kilitlense de) ve aile üyelerinin telefonuna bildirim; ikisi de
        // gönderimi bekletmez, SOS kaydı zaten gitti.
        const background = await startBackgroundSharing(id, liveUntil, { title: t('sos.fgTitle'), body: t('sos.fgBody') });
        const unreachable = await sendSosPush({ id, fromName, test, recipients }, 'yardim').catch(() => recipients);
        router.replace({ pathname: '/sos/[id]', params: { id, bg: background ? '1' : '0', nopush: unreachable.join(',') } });
      } catch (e) {
        setError(e instanceof SosSendTimeoutError ? t('sos.timeout') : t('sos.sendError'));
      } finally {
        setSending(false);
      }
    },
    [user, profile, members, loc, config, router, t],
  );

  const start = () => {
    setError(undefined);
    let n = config.countdownSeconds;
    setCountdown(n);
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(timer.current);
        setCountdown(null);
        send(false);
      } else setCountdown(n);
    }, 1000);
  };
  const cancel = () => {
    clearInterval(timer.current);
    setCountdown(null);
  };

  const header = <HeroHeader title={t('sos.title')} onBack={() => goBackOr(router, '/urgent')} right={{ icon: 'history', label: t('sos.history'), onPress: () => router.push('/sos/history') }} />;

  const locText =
    loc.status === 'ready'
      ? t('sos.locationReady', { meters: loc.location.accuracy ?? '?' })
      : loc.status === 'waiting'
        ? t('sos.locationWaiting')
        : loc.status === 'denied'
          ? t('sos.locationDenied')
          : t('sos.locationUnavailable');

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.warning, { backgroundColor: c.dangerSoft, borderColor: c.danger }]}>
          <AppText variant="label" style={{ color: c.danger }}>{t('sos.disclaimerTitle')}</AppText>
          <AppText variant="caption">{t('sos.disclaimer')}</AppText>
          <AppButton variant="secondary" title={t('sos.call112')} onPress={() => Linking.openURL(telUrl('112')).catch(() => {})} />
        </View>

        {!user ? (
          <FormMessage kind="info" text={t('sos.signIn')} />
        ) : members === null ? (
          <StateMessage kind="loading" />
        ) : members.length === 0 ? (
          <>
            <FormMessage kind="error" text={t('sos.noFamily')} />
            <AppButton title={t('sos.manageFamily')} onPress={() => router.push('/family')} />
          </>
        ) : (
          <>
            {error ? <FormMessage kind="error" text={error} /> : null}
            {countdown !== null ? (
              <View style={styles.center}>
                <View
                  accessible
                  accessibilityLiveRegion="assertive"
                  accessibilityLabel={t('sos.countdownLabel', { seconds: countdown })}
                  style={[styles.button, { backgroundColor: c.danger }]}>
                  <AppText style={[styles.count, { color: c.onDanger }]}>{t('sos.countdown', { seconds: countdown })}</AppText>
                </View>
                <AppText variant="label">{t('sos.countdownLabel', { seconds: countdown })}</AppText>
                <AppButton variant="secondary" title={t('sos.cancel')} onPress={cancel} />
              </View>
            ) : (
              <View style={styles.center}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('sos.pressLabel')}
                  accessibilityHint={t('sos.pressHint', { seconds: config.countdownSeconds })}
                  disabled={sending}
                  onPress={start}
                  style={({ pressed }) => [styles.button, { backgroundColor: c.danger, opacity: pressed || sending ? 0.8 : 1 }]}>
                  <MaterialIcons name="sos" size={56} color={c.onDanger} />
                  <AppText variant="label" style={{ color: c.onDanger }}>{sending ? t('sos.sending') : t('sos.pressLabel')}</AppText>
                </Pressable>
                <AppText variant="caption" muted style={styles.centerText}>{t('sos.pressHint', { seconds: config.countdownSeconds })}</AppText>
              </View>
            )}

            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={styles.line}>
                <MaterialIcons name={loc.status === 'ready' ? 'my-location' : 'location-disabled'} size={20} color={loc.status === 'ready' ? c.success : c.textMuted} />
                <AppText variant="caption" style={styles.flex}>{locText}</AppText>
              </View>
              <AppText variant="label">{t('sos.recipients', { count: members.length })}</AppText>
              <AppText variant="caption" muted>{members.map((m) => m.name).join(', ')}</AppText>
              <AppButton variant="ghost" title={t('sos.manageFamily')} onPress={() => router.push('/family')} />
            </View>

            <SosReadiness />
            <AppButton variant="secondary" title={t('sos.test')} disabled={sending || countdown !== null} onPress={() => send(true)} />
            <AppText variant="caption" muted>{t('sos.testHint')}</AppText>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  flex: { flex: 1 },
  warning: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  center: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  centerText: { textAlign: 'center' },
  button: { width: 180, height: 180, borderRadius: 90, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  count: { fontSize: 72, lineHeight: 80, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
