import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { POST_TARGETS, type Announcement, type Post, type PostTarget } from '@cityjoy/shared';
import type { FeedFilter } from '@cityjoy/shared/firebase';

import { AnnouncementCard } from '@/components/announcement-card';
import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Chips } from '@/components/chips';
import { FormMessage } from '@/components/form-message';
import { BottomNav } from '@/components/bottom-nav';
import { HeroHeader, LocationChip } from '@/components/hero-header';
import { PostCard } from '@/components/post-card';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useAnnouncements } from '@/lib/announcements';
import { locationRepository as repo } from '@/lib/locations';
import { toggleLike, useFeed, useLiked } from '@/lib/posts';
import { useSession } from '@/lib/session';
import { useSocial } from '@/lib/social';
import { useUserLocation } from '@/lib/user-location';
import { spacing } from '@/theme/tokens';

/**
 * Keşfet (PROJE.md 5.5): Mahallem (kendi mahallesi), Bölgesel (kendi ili, istenirse ilçesi), Genel (herkes).
 * Acil duyurular akışın en üstünde sabit. Aşağı kaydırdıkça sonraki sayfa gelir, aşağı çekince yenilenir.
 * Takip sekmesi: takip ettiklerimin "Takip" hedefli gönderileri. Engellediklerimin gönderileri hiçbir sekmede görünmez.
 */
export default function ExploreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useSession();
  const { location } = useUserLocation();
  const [tab, setTab] = useState<PostTarget>('mahallem');
  const [onlyDistrict, setOnlyDistrict] = useState(false);
  const { me, blocked, following } = useSocial();
  const district = location?.districtId ? repo.getDistrict(location.districtId) : undefined;
  const province = location ? repo.getProvince(location.provinceCode)?.name : undefined;

  const filter: FeedFilter | null =
    !user || !location ? null
    : tab === 'mahallem' ? (location.neighbourhoodId ? { target: 'mahallem', neighbourhoodId: location.neighbourhoodId } : null)
    : tab === 'bolgesel' ? { target: 'bolgesel', provinceCode: location.provinceCode, ...(onlyDistrict && district ? { districtId: district.id } : {}) }
    : tab === 'takip' ? (following ? { target: 'takip', authorUids: following.filter((u) => !blocked.has(u)) } : null)
    : { target: 'genel' };
  const feed = useFeed(filter);
  const { hasMore, failed, loadingMore, reload, loadMore } = feed;
  // Engellediklerimin gönderileri görünmez.
  const posts = feed.posts?.filter((p) => !blocked.has(p.authorUid)) ?? (tab === 'takip' && following === null ? null : feed.posts);
  const isLiked = useLiked(user?.uid);
  const [, rerender] = useState(0);
  const { list: announcements } = useAnnouncements(location, 'hepsi');
  const urgent = tab === 'genel' || tab === 'takip' ? [] : (announcements ?? []).filter((a) => a.kind === 'acil');

  // Resmî duyurular (muhtar, belediye, kurum) kullanıcı gönderileriyle zaman sırasına göre karışık akar (PROJE.md 5.5,
  // Eren onayladı): Mahallem'de mahalleye ve ilçeye yönelik olanlar, Bölgesel'de hepsi. Akışın sonu henüz gelmediyse
  // yalnızca okunan en eski gönderiden yeni olanlar girer (sayfa geldikçe sırası bozulmasın).
  const oldest = hasMore && posts?.length ? posts[posts.length - 1].createdAt : '';
  const official =
    tab === 'mahallem' || tab === 'bolgesel'
      ? (announcements ?? []).filter(
          (a) =>
            a.kind !== 'acil' && (a.publishedAt ?? '') >= oldest &&
            (tab === 'bolgesel' ? !onlyDistrict || !district || a.region.districtId === district.id : !!a.region.districtId),
        )
      : [];
  type Item = { kind: 'post'; post: Post; at: string } | { kind: 'ann'; ann: Announcement; at: string };
  const items: Item[] | null = posts
    ? [...posts.map((p) => ({ kind: 'post' as const, post: p, at: p.createdAt })), ...official.map((a) => ({ kind: 'ann' as const, ann: a, at: a.publishedAt ?? '' }))].sort(
        (a, b) => b.at.localeCompare(a.at),
      )
    : null;

  const like = async (id: string) => {
    const p = posts?.find((x) => x.id === id);
    if (!p || !user) return;
    await toggleLike(p, user.uid, isLiked(id)).catch(() => {});
    rerender((n) => n + 1);
  };

  const header = (
    <HeroHeader
      title={t('explore.title')}
      right={
        user
          ? [
              { icon: 'chat-bubble-outline', label: t('messages.title'), onPress: () => router.push('/messages') },
              ...(location ? [{ icon: 'add' as const, label: t('explore.newPost'), onPress: () => router.push('/explore/new') }] : []),
            ]
          : undefined
      }>
      <LocationChip label={province ?? t('home.noLocation')} onPress={() => router.push('/location?edit=1')} />
    </HeroHeader>
  );

  const top = (
    <View style={styles.top}>
      <Chips<PostTarget>
        label={t('explore.title')}
        value={tab}
        onChange={setTab}
        options={POST_TARGETS.map((x) => ({ value: x, label: t(`explore.targets.${x}`) }))}
      />
      {tab === 'bolgesel' && district ? (
        <Chips<number>
          label={t('explore.targets.bolgesel')}
          value={onlyDistrict ? 1 : 0}
          onChange={(v) => setOnlyDistrict(v === 1)}
          options={[{ value: 0, label: province ?? '' }, { value: 1, label: district.name }]}
        />
      ) : null}
      <AppText variant="caption" muted>{tab === 'takip' ? t('explore.takipFeedHint') : t(`explore.tabHints.${tab}`)}</AppText>
      {urgent.map((a) => (
        <AnnouncementCard key={a.id} item={a} onPress={() => router.push({ pathname: '/announcements/[id]', params: { id: a.id } })} />
      ))}
      {user && location ? <AppButton title={t('explore.newPost')} onPress={() => router.push('/explore/new')} /> : null}
      {tab === 'takip' && following?.length === 0 ? <FormMessage kind="info" text={t('explore.followHint')} /> : null}
      {user ? (
        <View style={styles.row}>
          {me ? <AppButton variant="ghost" title={t('explore.profile.mine')} onPress={() => router.push({ pathname: '/u/[uid]', params: { uid: me.uid } })} /> : null}
          <AppButton variant="ghost" title={t('explore.saved')} onPress={() => router.push('/explore/saved')} />
        </View>
      ) : null}
    </View>
  );

  if (!user || !location || (tab === 'mahallem' && !location.neighbourhoodId)) {
    return (
      <Screen header={header} footer={<BottomNav active="explore" />}>
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
    <Screen header={header} footer={<BottomNav active="explore" />}>
      <FlatList
        data={items ?? []}
        keyExtractor={(i) => (i.kind === 'post' ? i.post.id : `a-${i.ann.id}`)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={top}
        renderItem={({ item: i }) =>
          i.kind === 'ann' ? (
            <AnnouncementCard item={i.ann} onPress={() => router.push({ pathname: '/announcements/[id]', params: { id: i.ann.id } })} />
          ) : (
            <PostCard
              item={i.post}
              liked={isLiked(i.post.id)}
              onPress={() => router.push({ pathname: '/explore/[id]', params: { id: i.post.id } })}
              onLike={() => like(i.post.id)}
              onAuthor={() => router.push({ pathname: '/u/[uid]', params: { uid: i.post.authorUid } })}
            />
          )
        }
        ListEmptyComponent={
          items === null ? <StateMessage kind="loading" />
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
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  center: { textAlign: 'center' },
});
