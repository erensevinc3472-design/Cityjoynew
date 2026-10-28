import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ACTIVITY_REPORT_REASONS,
  canJoinActivity,
  canUseActivities,
  isActivityListed,
  type Activity,
  type ActivityReportReason,
} from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { CheckboxRow } from '@/components/checkbox-row';
import { Chips } from '@/components/chips';
import { FormMessage } from '@/components/form-message';
import { HeroHeader } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { cachedActivity, patchCachedActivity, useNeighbourhoodNames } from '@/lib/activities';
import { locationRepository as repo } from '@/lib/locations';
import { activityRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Aktivite ayrıntısı: düzenleyen ("Ayşe K."), tarih, mahalle; tam buluşma yeri yalnızca katılınca. "Katılıyorum"
 * (18+, adı paylaşmak isteğe bağlı), düzenleyen için katılanlar ve iptal, herkese ilk buluşma ipuçları ve şikâyet.
 */
export default function ActivityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const { user, profile } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<Activity | null | undefined>(() => cachedActivity(id));
  const [failed, setFailed] = useState(false);
  const [attending, setAttending] = useState<{ shareName: boolean } | null | undefined>(undefined);
  const [address, setAddress] = useState<string | null>(null);
  const [names, setNames] = useState<string[] | null>(null);
  const [shareName, setShareName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [reporting, setReporting] = useState<ActivityReportReason | null>(null);
  const [reported, setReported] = useState(false);
  const nbNames = useNeighbourhoodNames(item ? [item] : null);
  const mine = !!item && !!user && item.organizerUid === user.uid;

  useEffect(() => {
    if (!user) return;
    activityRepository.get(id).then(setItem, () => setFailed(true));
  }, [id, user]);

  useEffect(() => {
    if (!user) return setAttending(null);
    activityRepository.myAttendance(id, user.uid).then(setAttending, () => setAttending(null));
    activityRepository.hasReported(id, user.uid).then(setReported);
  }, [id, user]);

  // Tam yer: düzenleyen ya da katılan (kurallar diğerlerine okutmaz).
  useEffect(() => {
    if (mine || attending) activityRepository.address(id).then(setAddress);
    else setAddress(null);
  }, [id, mine, attending]);

  useEffect(() => {
    if (mine) activityRepository.namedAttendees(id).then(setNames, () => setNames([]));
  }, [id, mine, item?.attendeeCount]);

  const header = <HeroHeader title={t('activities.one')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/activities'))} />;

  if (!user || failed || item === undefined || !item || (!mine && !isActivityListed(item))) {
    return (
      <Screen header={header}>
        <View style={styles.content}>
          {!user ? <FormMessage kind="info" text={t('activities.signIn')} /> : failed ? <StateMessage kind="error" message={t('activities.loadError')} /> : item === undefined ? <StateMessage kind="loading" /> : <StateMessage kind="empty" message={t('activities.gone')} />}
        </View>
      </Screen>
    );
  }

  const cancelled = item.status === 'iptal';
  const start = new Date(item.startsAt);
  const end = new Date(item.endsAt);
  const place = [nbNames[item.region.neighbourhoodId], repo.getDistrict(item.region.districtId)?.name, repo.getProvince(item.region.provinceCode)?.name].filter(Boolean).join(', ');
  const left = Math.max(0, item.capacity - item.attendeeCount);
  const adult = canUseActivities(profile?.birthYear);
  const mapLink = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, ${place}`)}` : undefined;

  const run = async (fn: () => Promise<void>, errKey: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch {
      setError(t(errKey));
    } finally {
      setBusy(false);
    }
  };

  const toggle = () =>
    run(async () => {
      const name = (profile?.displayName ?? '').trim();
      if (attending) await activityRepository.leave(item.id, user.uid);
      else await activityRepository.join(item.id, user.uid, shareName && name ? { name } : null);
      const count = item.attendeeCount + (attending ? -1 : 1);
      patchCachedActivity(item.id, { attendeeCount: count });
      setItem({ ...item, attendeeCount: count });
      setAttending(attending ? null : { shareName: shareName && !!name });
    }, 'activities.attendError');

  const cancel = () =>
    run(async () => {
      await activityRepository.cancel(item.id);
      patchCachedActivity(item.id, { status: 'iptal' });
      setItem({ ...item, status: 'iptal' });
    }, 'activities.saveError');

  const report = () =>
    run(async () => {
      await activityRepository.report(item, user.uid, reporting!);
      setReported(true);
      setReporting(null);
    }, 'activities.reportError');

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content}>
        {cancelled ? <FormMessage kind="error" text={t('activities.cancelledNote')} /> : null}
        <AppText variant="caption" muted>{t(`activities.categories.${item.category}`)}</AppText>
        <AppText accessibilityRole="header" style={[styles.title, { color: c.textStrong }]}>{item.title}</AppText>
        <AppText variant="caption" muted>{mine ? t('activities.yours') : t('activities.by', { name: item.organizerName })}</AppText>

        <View style={styles.meta}>
          <AppText variant="label">{t('activities.when')}</AppText>
          <AppText>
            {start.toLocaleDateString(lang, { dateStyle: 'full' })}, {start.toLocaleTimeString(lang, { timeStyle: 'short' })} - {end.toLocaleTimeString(lang, { timeStyle: 'short' })}
          </AppText>
        </View>
        <View style={styles.meta}>
          <AppText variant="label">{t('activities.where')}</AppText>
          <AppText>{place}</AppText>
          {address ? <AppText selectable>{address}</AppText> : <AppText variant="caption" muted>{t('activities.addressHidden')}</AppText>}
        </View>
        {mapLink ? <AppButton variant="secondary" title={t('events.openMap')} onPress={() => Linking.openURL(mapLink).catch(() => {})} /> : null}

        <AppText selectable>{item.description}</AppText>

        <View style={styles.meta}>
          <AppText variant="label">{t('activities.attendance')}</AppText>
          <AppText muted>{t('activities.attendingOf', { count: item.attendeeCount, capacity: item.capacity })}</AppText>
          {mine && names ? <AppText variant="caption" muted>{names.length ? t('activities.namedList', { names: names.join(', ') }) : t('activities.noNames')}</AppText> : null}
        </View>

        {mine ? (
          cancelled ? null : (
            <>
              <AppButton variant="ghost" title={t('activities.cancel')} loading={busy} disabled={busy} onPress={cancel} />
              <AppText variant="caption" muted>{t('activities.noEditNote')}</AppText>
            </>
          )
        ) : cancelled ? null : !adult ? (
          <FormMessage kind="info" text={t('activities.adultsOnly')} />
        ) : attending === undefined ? (
          <StateMessage kind="loading" />
        ) : attending ? (
          <>
            <FormMessage kind="info" text={attending.shareName ? t('activities.youAttendNamed') : t('activities.youAttend')} />
            <AppButton variant="ghost" title={t('events.leave')} loading={busy} disabled={busy} onPress={toggle} />
          </>
        ) : !canJoinActivity(item) ? (
          <FormMessage kind="info" text={left ? t('activities.closed') : t('activities.full')} />
        ) : (
          <>
            <CheckboxRow checked={shareName} onToggle={() => setShareName((x) => !x)} label={t('activities.shareName')} />
            <AppButton title={t('events.attend')} loading={busy} disabled={busy} onPress={toggle} />
          </>
        )}
        {error ? <FormMessage kind="error" text={error} /> : null}

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <AppText variant="label">{t('activities.safetyTitle')}</AppText>
          <AppText variant="caption" muted>{t('activities.safetyTips')}</AppText>
        </View>

        {mine ? null : reported ? (
          <AppText variant="caption" muted>{t('activities.reported')}</AppText>
        ) : reporting ? (
          <View style={styles.meta}>
            <AppText variant="label">{t('activities.reportTitle')}</AppText>
            <Chips<ActivityReportReason> label={t('activities.reportTitle')} value={reporting} onChange={setReporting} options={ACTIVITY_REPORT_REASONS.map((r) => ({ value: r, label: t(`activities.reasons.${r}`) }))} />
            <AppButton title={t('activities.reportSend')} loading={busy} disabled={busy} onPress={report} />
            <AppButton variant="ghost" title={t('account.cancel')} onPress={() => setReporting(null)} />
          </View>
        ) : (
          <AppButton variant="ghost" title={t('activities.report')} onPress={() => setReporting('uygunsuz')} />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  title: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 29 },
  meta: { gap: spacing.xs },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, gap: spacing.xs },
});
