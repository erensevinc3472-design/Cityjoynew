import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { isEventVisible, remainingSeats, type CityEvent } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { CheckboxRow } from '@/components/checkbox-row';
import { FormMessage } from '@/components/form-message';
import { HeroHeader } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useAuthorLabel, useNeighbourhoodName } from '@/lib/announcements';
import { cachedEvent, patchCachedEvent } from '@/lib/events';
import { locationRepository as repo } from '@/lib/locations';
import { eventRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { fonts, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Etkinlik ayrıntısı: düzenleyen (resmî hesap), tarih, yer (adres herkese açık, haritada aç), ücret, resmî bilet
 * bağlantısı, kontenjan ve "Katılıyorum". Kişinin adı düzenleyene yalnızca kendi izniyle görünür.
 */
export default function EventScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const { user, profile } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<CityEvent | null | undefined>(() => cachedEvent(id));
  const [failed, setFailed] = useState(false);
  const [attending, setAttending] = useState<{ shareName: boolean } | null | undefined>(undefined);
  const [shareName, setShareName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const author = useAuthorLabel(item);
  const neighbourhood = useNeighbourhoodName(item);

  useEffect(() => {
    if (item !== undefined) return;
    eventRepository.get(id).then(setItem, () => setFailed(true));
  }, [id, item]);

  useEffect(() => {
    if (!user) return setAttending(null);
    eventRepository.myAttendance(id, user.uid).then(setAttending, () => setAttending(null));
  }, [id, user]);

  const when = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString(lang, opts);
  const header = <HeroHeader title={t('events.one')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/events'))} />;

  if (failed || item === undefined || !item || !isEventVisible(item)) {
    return (
      <Screen header={header}>
        <View style={styles.content}>
          {failed ? <StateMessage kind="error" message={t('events.loadError')} /> : item === undefined ? <StateMessage kind="loading" /> : <StateMessage kind="empty" message={t('events.gone')} />}
        </View>
      </Screen>
    );
  }

  const cancelled = item.status === 'iptal';
  const seats = remainingSeats(item);
  const full = seats === 0;
  const place = [neighbourhood, item.region.districtId ? repo.getDistrict(item.region.districtId)?.name : null, repo.getProvince(item.region.provinceCode)?.name].filter(Boolean).join(', ');
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([item.venueName, item.address, place].filter(Boolean).join(', '))}`;
  const open = (url: string) => Linking.openURL(url).catch(() => {});
  const sameDay = new Date(item.startsAt).toDateString() === new Date(item.endsAt).toDateString();
  const dateText = sameDay
    ? `${when(item.startsAt, { dateStyle: 'full' })}, ${when(item.startsAt, { timeStyle: 'short' })} - ${when(item.endsAt, { timeStyle: 'short' })}`
    : `${when(item.startsAt, { dateStyle: 'medium', timeStyle: 'short' })} - ${when(item.endsAt, { dateStyle: 'medium', timeStyle: 'short' })}`;

  const toggle = async () => {
    if (!user) return;
    setBusy(true);
    setError(false);
    try {
      const name = (profile?.displayName ?? user.displayName ?? '').trim();
      if (attending) await eventRepository.leave(item.id, user.uid);
      else await eventRepository.join(item.id, user.uid, shareName && name ? { name } : null);
      const count = item.attendeeCount + (attending ? -1 : 1);
      patchCachedEvent(item.id, { attendeeCount: count });
      setItem({ ...item, attendeeCount: count });
      setAttending(attending ? null : { shareName: shareName && !!name });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content}>
        {cancelled ? <FormMessage kind="error" text={t('events.cancelledNote')} /> : null}
        <AppText variant="caption" muted>{t(`events.categories.${item.category}`)}</AppText>
        <AppText accessibilityRole="header" style={[styles.title, { color: c.textStrong }]}>{item.title}</AppText>
        <View style={styles.meta}>
          <AppText variant="label">{author}</AppText>
          <AppText variant="caption" muted>{t('announcements.official')}</AppText>
        </View>

        <View style={styles.meta}>
          <AppText variant="label">{t('events.when')}</AppText>
          <AppText>{dateText}</AppText>
        </View>
        <View style={styles.meta}>
          <AppText variant="label">{t('events.where')}</AppText>
          <AppText>{item.venueName}</AppText>
          {item.address ? <AppText muted>{item.address}</AppText> : null}
          <AppText variant="caption" muted>{place}</AppText>
        </View>
        <AppButton variant="secondary" title={t('events.openMap')} onPress={() => open(mapLink)} />
        <View style={styles.meta}>
          <AppText variant="label">{t('events.price')}</AppText>
          <AppText>{item.free ? t('events.free') : item.priceNote}</AppText>
        </View>
        {item.ticketUrl ? <AppButton variant="secondary" title={t('events.ticket')} onPress={() => open(item.ticketUrl!)} /> : null}
        {item.ticketUrl ? <AppText variant="caption" muted>{t('events.ticketNote')}</AppText> : null}

        <AppText selectable>{item.description}</AppText>

        <View style={styles.meta}>
          <AppText variant="label">{t('events.attendance')}</AppText>
          <AppText muted>
            {seats === null ? t('events.attending', { count: item.attendeeCount }) : t('events.seatsLeft', { count: seats, capacity: item.capacity })}
          </AppText>
        </View>
        {cancelled ? null : !user ? (
          <FormMessage kind="info" text={t('events.signIn')} />
        ) : attending === undefined ? (
          <StateMessage kind="loading" />
        ) : attending ? (
          <>
            <FormMessage kind="info" text={attending.shareName ? t('events.youAttendNamed') : t('events.youAttend')} />
            <AppButton variant="ghost" title={t('events.leave')} loading={busy} disabled={busy} onPress={toggle} />
          </>
        ) : full ? (
          <FormMessage kind="info" text={t('events.full')} />
        ) : (
          <>
            <CheckboxRow checked={shareName} onToggle={() => setShareName((x) => !x)} label={t('events.shareName')} />
            <AppButton title={t('events.attend')} loading={busy} disabled={busy} onPress={toggle} />
          </>
        )}
        {error ? <FormMessage kind="error" text={t('events.attendError')} /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  title: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 29 },
  meta: { gap: 2 },
});
