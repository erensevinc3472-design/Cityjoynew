import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NEWS_CATEGORIES, readingMinutes, type Announcement } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { HeroHeader } from '@/components/hero-header';
import { FeaturedCard, FilterChip, FilterRow, ListRow, ListSurface, RowIcon, Tag } from '@/components/inner';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useAnnouncements, useAuthorLabel } from '@/lib/announcements';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type Scope = 'bolgesel' | 'genel';

/**
 * Haberler (PROJE.md 5.3; iç ekran tasarımı 13. madde 35). Birinci kaynak resmî kurumlar: belediye, valilik, kaymakamlık
 * ve kurumların panelden yazdığı "Kurum haberleri" (hukuki risk en düşük). Bölgesel: ilindeki, ilçendeki ve mahallendeki
 * kurum haberleri, kategoriye göre süzülür. Her haberde kaynağın adı yazar. Genel (ülke geneli) haberler ve yayıncı
 * haberlerinde "kaynağa git" izin veren yayıncılarla gelecek. Haberler duyurularla aynı okumadan gelir; ek maliyet yok.
 */
export default function NewsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { location } = useUserLocation();
  const { list, failed, reload } = useAnnouncements(location, 'haberler');
  const [scope, setScope] = useState<Scope>('bolgesel');
  const [category, setCategory] = useState<string | null>(null);
  const province = location ? repo.getProvince(location.provinceCode)?.name : undefined;
  // Yalnızca haberi olan kategoriler gösterilir.
  const present = NEWS_CATEGORIES.filter((k) => list?.some((a) => a.category === k));
  const shown = list?.filter((a) => !category || a.category === category) ?? null;
  const open = (a: Announcement) => router.push({ pathname: '/announcements/[id]', params: { id: a.id } });
  const [first, ...rest] = shown ?? [];

  const header = (
    <HeroHeader
      title={t('news.title')}
      subtitle={province ? t('news.subtitle', { place: province }) : undefined}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/social'))}
    />
  );

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />} showsVerticalScrollIndicator={false}>
        <View style={[styles.seg, { backgroundColor: c.surface, borderColor: c.border }]}>
          <FilterChip label={t('news.regional')} active={scope === 'bolgesel'} onPress={() => setScope('bolgesel')} />
          <FilterChip label={t('news.general')} active={scope === 'genel'} onPress={() => setScope('genel')} />
        </View>
        {scope === 'genel' ? (
          <StateMessage kind="empty" message={t('news.generalSoon')} />
        ) : !location ? (
          <>
            <StateMessage kind="empty" message={t('news.needLocation')} />
            <AppButton title={t('home.changeLocation')} onPress={() => router.push('/location?edit=1')} />
          </>
        ) : (
          <>
            <FilterRow kinds={present.map((k) => ({ id: k, name: t(`news.categories.${k}`) }))} kind={category} onKind={setCategory} />
            {failed && !list?.length ? (
              <StateMessage kind="error" message={t('news.loadError')} onRetry={reload} />
            ) : shown === null ? (
              <StateMessage kind="loading" />
            ) : !first ? (
              <StateMessage kind="empty" message={t('news.empty')} />
            ) : (
              <>
                <FeaturedNews item={first} onPress={() => open(first)} />
                {rest.length ? (
                  <ListSurface>
                    {rest.map((a, n) => (
                      <NewsRow key={a.id} item={a} first={n === 0} onPress={() => open(a)} />
                    ))}
                  </ListSurface>
                ) : null}
              </>
            )}
          </>
        )}
        <AppText variant="caption" muted>{t('news.sourceNote')}</AppText>
        <View style={[styles.publisher, { borderColor: c.accentBorder }]}>
          <MaterialIcons name="rss-feed" size={20} color={c.accent} />
          <View style={styles.flex}>
            <AppText variant="label" style={{ color: c.textStrong }}>{t('news.publisherTitle')}</AppText>
            <AppText variant="caption" muted>{t('news.publisherText')}</AppText>
          </View>
          <Tag label={t('city.soon')} tone="muted" />
        </View>
      </ScrollView>
    </Screen>
  );
}

function useMeta(item: Announcement) {
  const { t } = useTranslation();
  const { language } = useSettings();
  const author = useAuthorLabel(item);
  const date = item.publishedAt ? new Date(item.publishedAt).toLocaleDateString(language ?? 'tr', { day: 'numeric', month: 'short' }) : '';
  return { author, date, minutes: t('news.readingTime', { count: readingMinutes(item.body) }) };
}

function FeaturedNews({ item, onPress }: { item: Announcement; onPress(): void }) {
  const { t } = useTranslation();
  const m = useMeta(item);
  return (
    <FeaturedCard
      kind="news"
      badge={item.category ? `${t('news.official')} · ${t(`news.categories.${item.category}`)}` : t('news.official')}
      title={item.title}
      meta={[m.author, m.date, m.minutes].filter(Boolean).join(' · ')}
      onPress={onPress}
    />
  );
}

function NewsRow({ item, first, onPress }: { item: Announcement; first: boolean; onPress(): void }) {
  const c = useThemeColors();
  const m = useMeta(item);
  return <ListRow first={first} leading={<RowIcon icon="newspaper" tint={c.primary} />} title={item.title} subtitle={[m.author, m.date].filter(Boolean).join(' · ')} onPress={onPress} />;
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  flex: { flex: 1, gap: 2 },
  seg: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.pill, borderWidth: 1, alignSelf: 'flex-start' },
  publisher: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed' },
});
