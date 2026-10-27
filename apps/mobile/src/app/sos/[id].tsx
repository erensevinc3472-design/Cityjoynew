import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  isLive,
  mapsUrl,
  remainingSeconds,
  shouldSendLocation,
  telUrl,
  type FamilyMember,
  type SosAlert,
  type SosStatus,
} from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { HeroHeader } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { watchLocation } from '@/lib/location';
import { goBackOr } from '@/lib/navigation';
import { familyRepository, sosRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * Bir SOS'un canlı görünümü. Gönderen: kalan süre, canlı konum, Güvendeyim / Yardım gerek / Durdur,
 * kişi başına "Teslim edildi / Görüldü". Alıcı: kimden, durum, konum ve "Haritada aç", 112.
 */
export default function SosDetailScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const [alert, setAlert] = useState<SosAlert | null | undefined>(undefined);
  const [names, setNames] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => new Date());
  const lastSent = useRef<SosAlert['location']>(undefined);

  const isSender = !!alert && alert.fromUid === user?.uid;
  const live = !!alert && isLive(alert, now);

  useEffect(() => sosRepository.watch(id, setAlert, () => setAlert(null)), [id]);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!user) return;
    familyRepository
      .listMembers(user.uid)
      .then((m: FamilyMember[]) => setNames(Object.fromEntries(m.map((x) => [x.uid, x.name]))))
      .catch(() => {});
  }, [user]);

  // Alıcı açınca "görüldü".
  useEffect(() => {
    if (alert && user && !isSender && alert.recipients.includes(user.uid) && !alert.seenBy[user.uid]) {
      sosRepository.markSeen(alert.id, user.uid).catch(() => {});
    }
  }, [alert, user, isSender]);

  // Gönderen: paylaşım sürerken ve ekran açıkken canlı konum (arka planda izleme yok).
  useEffect(() => {
    if (!isSender || !live || !alert) return;
    lastSent.current = alert.location;
    let stop: (() => void) | undefined;
    let cancelled = false;
    watchLocation((l) => {
      if (shouldSendLocation(lastSent.current, l)) {
        lastSent.current = { ...l, at: new Date().toISOString() };
        sosRepository.updateLocation(id, l).catch(() => {});
      }
    }).then((s) => (cancelled ? s() : (stop = s)));
    return () => {
      cancelled = true;
      stop?.();
    };
    // Yalnızca canlılık değişince yeniden başlar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSender, live, id]);

  const setStatus = (s: SosStatus) => sosRepository.setStatus(id, s).catch(() => {});
  const time = (iso: string) => new Date(iso).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });

  const header = <HeroHeader title={t('sos.title')} onBack={() => goBackOr(router, isSender ? '/sos' : '/home')} />;
  if (alert === undefined) {
    return (
      <Screen header={header}>
        <StateMessage kind="loading" />
      </Screen>
    );
  }
  if (!alert) {
    return (
      <Screen header={header}>
        <StateMessage kind="empty" message={t('sos.notFound')} />
      </Screen>
    );
  }

  const statusText = { aktif: t('sos.statusActive'), yardim: t('sos.statusHelp'), guvende: t('sos.statusSafe'), bitti: t('sos.statusEnded') }[alert.status];
  const statusColor = alert.status === 'guvende' ? c.success : alert.status === 'bitti' ? c.textMuted : c.danger;

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {alert.test ? (
          <View style={[styles.badge, { borderColor: c.accentBorder }]}>
            <AppText variant="caption" style={{ color: c.highlight }}>{t('sos.testBadge')}</AppText>
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: statusColor }]}>
          <AppText variant="subtitle" accessibilityRole="header">
            {isSender ? (alert.test ? t('sos.sentTestTitle') : t('sos.sentTitle')) : alert.fromName}
          </AppText>
          {isSender && alert.status === 'aktif' ? null : (
            <View style={styles.line}>
              <MaterialIcons name={alert.status === 'guvende' ? 'verified-user' : 'sos'} size={20} color={statusColor} />
              <AppText variant="label" style={{ color: statusColor }}>{statusText}</AppText>
            </View>
          )}
          <AppText variant="caption" muted>{t('sos.sentAt', { time: time(alert.createdAt) })}</AppText>
          <AppText variant="caption" accessibilityLiveRegion="polite">
            {live ? t('sos.live', { time: mmss(remainingSeconds(alert, now)) }) : t('sos.liveEnded')}
          </AppText>
        </View>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          {alert.location ? (
            <>
              <AppText selectable style={{ color: c.textStrong }}>
                {`${alert.location.lat.toFixed(5)}, ${alert.location.lng.toFixed(5)}${alert.location.accuracy != null ? ` (±${alert.location.accuracy} m)` : ''}`}
              </AppText>
              <AppText variant="caption" muted>{t('sos.lastUpdate', { time: time(alert.location.at) })}</AppText>
              <AppButton variant="secondary" title={t('sos.openMap')} onPress={() => Linking.openURL(mapsUrl(alert.location!)).catch(() => {})} />
            </>
          ) : (
            <AppText muted>{t('sos.noLocation')}</AppText>
          )}
        </View>

        {isSender ? (
          <>
            {live ? (
              <View style={styles.row}>
                <View style={styles.flex}>
                  <AppButton title={t('sos.safe')} onPress={() => setStatus('guvende')} />
                </View>
                <View style={styles.flex}>
                  <AppButton variant="secondary" title={t('sos.needHelp')} onPress={() => setStatus('yardim')} />
                </View>
              </View>
            ) : null}

            <AppText variant="label" accessibilityRole="header">{t('sos.recipientsTitle')}</AppText>
            {alert.recipients.map((uid) => {
              const seen = alert.seenBy[uid];
              const delivered = alert.deliveredTo[uid];
              return (
                <View key={uid} style={[styles.person, { borderColor: c.border }]}>
                  <AppText style={styles.flex}>{names[uid] ?? '-'}</AppText>
                  <MaterialIcons name={seen ? 'visibility' : delivered ? 'done-all' : 'schedule'} size={18} color={seen ? c.success : c.textMuted} />
                  <AppText variant="caption" style={{ color: seen ? c.success : c.textMuted }}>
                    {seen ? t('sos.seen') : delivered ? t('sos.delivered') : t('sos.pending')}
                  </AppText>
                </View>
              );
            })}
            {live ? <AppButton variant="ghost" title={t('sos.stop')} onPress={() => setStatus('bitti')} /> : null}
            <AppText variant="caption" muted>{t('sos.appOpenNote')}</AppText>
          </>
        ) : (
          <AppButton title={t('sos.call112')} onPress={() => Linking.openURL(telUrl('112')).catch(() => {})} />
        )}
        <AppText variant="caption" muted>{t('sos.disclaimer')}</AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.sm },
  badge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm },
});
