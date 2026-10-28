import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { PostTarget } from '@cityjoy/shared';
import type { FeedFilter } from '@cityjoy/shared/firebase';

import { AnnouncementCard } from '@/components/announcement-card';
import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Chips } from '@/components/chips';
import { FormMessage } from '@/components/form-message';
import { HeroHeader, LocationChip } from '@/components/hero-header';
import { PostCard } from '@/components/post-card';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useAnnouncements } from '@/lib/announcements';
import { locationRepository as repo } from '@/lib/locations';
import { toggleLike, useFeed, useLiked } from '@/lib/posts';
import { useSession } from '@/lib/session';
import { useUserLocation } from '@/lib/user-location';
import { spacing } from '@/theme/tokens';

/**
 * Keşfet (PROJE.md 5.5): Mahallem (kendi mahallesi), Bölgesel (kendi ili, istenirse ilçesi), Genel (herkes).
 * Acil duyurular akışın en üstünde sabit. Aşağı kaydırdıkça sonraki sayfa gelir, aşağı çekince yenilenir.
 * Takip sekmesi takip sistemiyle gelecek.
 */
export default function ExploreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useSession();
  const { location } = useUserLocation();
  const [tab, setTab] = useState<PostTarget>('mahallem');
  const [onlyDistrict, setOnlyDistrict] = useState(false);
  const district = location?.districtId ? repo.getDistrict(location.districtId) : undefined;
  const province = location ? repo.getProvince(location.provinceCode)?.name : undefined;

  const filter: FeedFilter | null =
    !user || !location ? null
    : tab === 'mahallem' ? (location.neighbourhoodId ? { target: 'mahallem', neighbourhoodId: location.neighbourhoodId } : null)
    : tab === 'bolgesel' ? { target: 'bolgesel', provinceCode: location.provinceCode, ...(onlyDistrict && district ? { districtId: district.id } : {}) }
    : { target: 'genel' };
  const { posts, hasMore, failed, loadingMore, reload, loadMore } = useFeed(filter);
  const isLiked = useLiked(user?.uid);
  const [, rerender] = useState(0);
  const { list: announcements } = useAnnouncements(location);
  const urgent = tab === 'genel' ? [] : (announcements ?? []).filter((a) => a.kind === 'acil');

  const like = async (id: string) => {
    const p = posts?.find((x) => x.id === id);
    if (!p || !user) return;
    await toggleLike(p, user.uid, isLiked(id)).catch(() => {});
    rerender((n) => n + 1);
  };

  const header = (
    <HeroHeader
      title={t('explore.title')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
      right={user && location ? { icon: 'add', label: t('explore.newPost'), onPress: () => router.push('/explore/new') } : undefined}>
      <LocationChip label={province ?? t('home.noLocation')} onPress={() => router.push('/location?edit=1')} />
    </HeroHeader>
  );

  const top = (
    <View style={styles.top}>
      <Chips<PostTarget>
        label={t('explore.title')}
        value={tab}
        onChange={setTab}
        options={(['mahallem', 'bolgesel', 'genel'] as const).map((x) => ({ value: x, label: t(`explore.targets.${x}`) }))}
      />
      {tab === 'bolgesel' && district ? (
        <Chips<number>
          label={t('explore.targets.bolgesel')}
          value={onlyDistrict ? 1 : 0}
          onChange={(v) => setOnlyDistrict(v === 1)}
          options={[{ value: 0, label: province ?? '' }, { value: 1, label: district.name }]}
        />
      ) : null}
      <AppText variant="caption" muted>{t(`explore.tabHints.${tab}`)}</AppText>
      {urgent.map((a) => (
        <AnnouncementCard key={a.id} item={a} onPress={() => router.push({ pathname: '/announcements/[id]', params: { id: a.id } })} />
      ))}
      {user && location ? <AppButton title={t('explore.newPost')} onPress={() => router.push('/explore/new')} /> : null}
    </View>
  );

  if (!user || !location || (tab === 'mahallem' && !location.neighbourhoodId)) {
    return (
      <Screen header={header}>
        <View style={styles.top}>
          {user && location ? top : null}
          {!user ? (
            <FormMessage kind="info" text={t('explore.signIn')} />
          ) : (
            <>
              <StateMessage kind="empty" message={location ? t('explore.needNeighbourhood') : t('explore.needLocation')} />
              <AppButton title={t('home.changeLocation')} onPress={() => router.push('/location?edit=1')} />
            </>
          )}
        </View>
      </Screen>
    );
  }

  return (
    <Screen header={header}>
      <FlatList
        data={posts ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={top}
        renderItem={({ item }) => (
          <PostCard
            item={item}
            liked={isLiked(item.id)}
            onPress={() => router.push({ pathname: '/explore/[id]', params: { id: item.id } })}
            onLike={() => like(item.id)}
          />
        )}
        ListEmptyComponent={
          posts === null ? <StateMessage kind="loading" />
          : failed ? <StateMessage kind="error" message={t('explore.loadError')} onRetry={reload} />
          : <StateMessage kind="empty" message={t('explore.empty')} />
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator /> : !hasMore && posts?.length ? <AppText variant="caption" muted style={styles.center}>{t('explore.end')}</AppText> : undefined}
        onEndReached={hasMore ? loadMore : undefined}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  top: { gap: spacing.sm },
  center: { textAlign: 'center' },
});
