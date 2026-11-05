import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { isAnnouncementLive, readingMinutes, type Announcement } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { AuthorLink } from '@/components/author-link';
import { FormMessage } from '@/components/form-message';
import { HeroHeader } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { cachedAnnouncement, useAuthorLabel, useNeighbourhoodName } from '@/lib/announcements';
import { locationRepository as repo } from '@/lib/locations';
import { announcementRepository, contentStats } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { fonts, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/** Haber okuyucusunda yazı boyu basamakları. */
const SIZES = [14, 16, 19, 22] as const;

/**
 * Duyuru ayrıntısı: yayınlayan (resmî hesap), hedef bölge, yayın ve bitiş tarihi, metnin tamamı. Kurum haberinde
 * kategori, okuma süresi, yazı boyu ve paylaş da var.
 */
export default function AnnouncementScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language } = useSettings();
  const { user } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<Announcement | null | undefined>(() => cachedAnnouncement(id));
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState(1);
  const author = useAuthorLabel(item);
  const neighbourhood = useNeighbourhoodName(item);

  useEffect(() => {
    if (item !== undefined) return;
    announcementRepository.get(id).then(setItem, () => setFailed(true));
  }, [id, item]);

  // Yayındaki içerik açılınca kişi başına bir okunma sayılır (belediye paneli, içerik istatistiği).
  const live = !!item && isAnnouncementLive(item);
  useEffect(() => {
    if (live && item && user) void contentStats.view('a', item, user.uid);
  }, [live, item, user]);

  const share = async () => {
    if (!item) return;
    try {
      const r = await Share.share({ message: `${item.title}\n\n${item.body.slice(0, 300)}\n\n${author} · CityJoy` });
      if (r.action === Share.sharedAction && user) void contentStats.share(item.id, user.uid);
    } catch {
      // Paylaşım penceresi açılamadıysa bir şey yapılmaz.
    }
  };

  const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(language ?? 'tr', { dateStyle: 'medium', timeStyle: 'short' }) : '');
  const region = item
    ? item.region.districtId
      ? [neighbourhood, repo.getDistrict(item.region.districtId)?.name, repo.getProvince(item.region.provinceCode)?.name].filter(Boolean).join(', ')
      : t('announcements.wholeProvince', { place: repo.getProvince(item.region.provinceCode)?.name ?? '' })
    : '';

  const news = item?.kind === 'haber';
  const header = (
    <HeroHeader
      title={item?.kind === 'acil' ? t('announcements.urgent') : news ? t('news.one') : t('announcements.one')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace(news ? '/news' : '/announcements'))}
    />
  );

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
            {news && item.category ? <AppText variant="caption" muted>{t(`news.categories.${item.category}`)}</AppText> : null}
            <AppText accessibilityRole="header" style={[styles.title, { color: c.textStrong }]}>{item.title}</AppText>
            <AuthorLink author={item.author} label={author} />
            <View style={styles.meta}>
              <AppText variant="caption" muted>{t('announcements.forRegion', { region })}</AppText>
              <AppText variant="caption" muted>{t('announcements.publishedAt', { date: when(item.publishedAt) })}</AppText>
              {item.endsAt ? <AppText variant="caption" muted>{t('announcements.until', { date: when(item.endsAt) })}</AppText> : null}
              {news ? <AppText variant="caption" muted>{t('news.readingTime', { count: readingMinutes(item.body) })}</AppText> : null}
            </View>
            {/* Haber okuyucusunda yazı boyu (PROJE.md 5.3); paylaş her duyuruda. */}
            <View style={styles.tools}>
              {news ? (
                <>
                  <AppButton variant="ghost" title={t('news.smaller')} disabled={size <= 0} onPress={() => setSize((s) => Math.max(0, s - 1))} />
                  <AppButton variant="ghost" title={t('news.larger')} disabled={size >= SIZES.length - 1} onPress={() => setSize((s) => Math.min(SIZES.length - 1, s + 1))} />
                </>
              ) : null}
              <AppButton variant="ghost" title={t('news.share')} onPress={share} />
            </View>
            <AppText selectable style={news ? { fontSize: SIZES[size], lineHeight: Math.round(SIZES[size] * 1.5) } : undefined}>{item.body}</AppText>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  title: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26 },
  meta: { gap: 2 },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
