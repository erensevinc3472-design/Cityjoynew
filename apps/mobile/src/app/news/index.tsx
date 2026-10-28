import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NEWS_CATEGORIES, type NewsCategory } from '@cityjoy/shared';

import { AnnouncementCard } from '@/components/announcement-card';
import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Chips } from '@/components/chips';
import { HeroHeader, LocationChip } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useAnnouncements } from '@/lib/announcements';
import { locationRepository as repo } from '@/lib/locations';
import { useUserLocation } from '@/lib/user-location';
import { spacing } from '@/theme/tokens';

type Scope = 'bolgesel' | 'genel';

/**
 * Haberler (PROJE.md 5.3). Birinci kaynak resmî kurumlar: belediye, valilik, kaymakamlık ve kurumların panelden
 * yazdığı "Kurum haberleri" (hukuki risk en düşük). Bölgesel: ilindeki, ilçendeki ve mahallendeki kurum haberleri,
 * kategoriye göre süzülür. Genel (ülke geneli) haberler, izin veren yayıncılarla gelecek (RSS başvurusu, sonraki adım).
 * Haberler duyurularla aynı okumadan gelir; ek maliyet yok.
 */
export default function NewsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { location } = useUserLocation();
  const { list, failed, reload } = useAnnouncements(location, 'haberler');
  const [scope, setScope] = useState<Scope>('bolgesel');
  const [category, setCategory] = useState<NewsCategory | 'hepsi'>('hepsi');
  const province = location ? repo.getProvince(location.provinceCode)?.name : undefined;
  // Yalnızca haberi olan kategoriler gösterilir.
  const present = NEWS_CATEGORIES.filter((c) => list?.some((a) => a.category === c));
  const shown = list?.filter((a) => category === 'hepsi' || a.category === category) ?? null;

  const header = (
    <HeroHeader title={t('news.title')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/social'))}>
      <LocationChip label={province ?? t('home.noLocation')} onPress={() => router.push('/location?edit=1')} />
    </HeroHeader>
  );

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}>
        <Chips<Scope> label={t('news.title')} value={scope} onChange={setScope} options={[{ value: 'bolgesel', label: t('news.regional') }, { value: 'genel', label: t('news.general') }]} />
        {scope === 'genel' ? (
          <StateMessage kind="empty" message={t('news.generalSoon')} />
        ) : !location ? (
          <>
            <StateMessage kind="empty" message={t('news.needLocation')} />
            <AppButton title={t('home.changeLocation')} onPress={() => router.push('/location?edit=1')} />
          </>
        ) : (
          <>
            <AppText variant="caption" muted>{t('news.regionalIntro')}</AppText>
            {present.length > 1 ? (
              <Chips<NewsCategory | 'hepsi'>
                label={t('news.category')}
                value={category}
                onChange={setCategory}
                options={[{ value: 'hepsi' as const, label: t('news.all') }, ...present.map((c) => ({ value: c, label: t(`news.categories.${c}`) }))]}
              />
            ) : null}
            {failed && !list?.length ? (
              <StateMessage kind="error" message={t('news.loadError')} onRetry={reload} />
            ) : shown === null ? (
              <StateMessage kind="loading" />
            ) : shown.length === 0 ? (
              <StateMessage kind="empty" message={t('news.empty')} />
            ) : (
              shown.map((a) => <AnnouncementCard key={a.id} item={a} onPress={() => router.push({ pathname: '/announcements/[id]', params: { id: a.id } })} />)
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
});
