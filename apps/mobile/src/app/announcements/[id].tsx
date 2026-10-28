import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { isAnnouncementLive, type Announcement } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { AuthorLink } from '@/components/author-link';
import { FormMessage } from '@/components/form-message';
import { HeroHeader } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { cachedAnnouncement, useAuthorLabel, useNeighbourhoodName } from '@/lib/announcements';
import { locationRepository as repo } from '@/lib/locations';
import { announcementRepository } from '@/lib/services';
import { useSettings } from '@/lib/settings';
import { fonts, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/** Duyuru ayrıntısı: yayınlayan (resmî hesap), hedef bölge, yayın ve bitiş tarihi, metnin tamamı. */
export default function AnnouncementScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language } = useSettings();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<Announcement | null | undefined>(() => cachedAnnouncement(id));
  const [failed, setFailed] = useState(false);
  const author = useAuthorLabel(item);
  const neighbourhood = useNeighbourhoodName(item);

  useEffect(() => {
    if (item !== undefined) return;
    announcementRepository.get(id).then(setItem, () => setFailed(true));
  }, [id, item]);

  const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(language ?? 'tr', { dateStyle: 'medium', timeStyle: 'short' }) : '');
  const region = item
    ? item.region.districtId
      ? [neighbourhood, repo.getDistrict(item.region.districtId)?.name, repo.getProvince(item.region.provinceCode)?.name].filter(Boolean).join(', ')
      : t('announcements.wholeProvince', { place: repo.getProvince(item.region.provinceCode)?.name ?? '' })
    : '';

  const header = <HeroHeader title={item?.kind === 'acil' ? t('announcements.urgent') : t('announcements.one')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/announcements'))} />;

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content}>
        {failed ? (
          <StateMessage kind="error" message={t('announcements.loadError')} />
        ) : item === undefined ? (
          <StateMessage kind="loading" />
        ) : !item || !isAnnouncementLive(item) ? (
          <StateMessage kind="empty" message={t('announcements.gone')} />
        ) : (
          <>
            {item.kind === 'acil' ? <FormMessage kind="error" text={t('announcements.urgentNote')} /> : null}
            <AppText accessibilityRole="header" style={[styles.title, { color: c.textStrong }]}>{item.title}</AppText>
            <AuthorLink author={item.author} label={author} />
            <View style={styles.meta}>
              <AppText variant="caption" muted>{t('announcements.forRegion', { region })}</AppText>
              <AppText variant="caption" muted>{t('announcements.publishedAt', { date: when(item.publishedAt) })}</AppText>
              {item.endsAt ? <AppText variant="caption" muted>{t('announcements.until', { date: when(item.endsAt) })}</AppText> : null}
            </View>
            <AppText selectable>{item.body}</AppText>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  title: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 29 },
  meta: { gap: 2 },
});
