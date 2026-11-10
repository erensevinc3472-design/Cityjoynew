import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Alert, Animated, FlatList, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions, type FlatListProps } from 'react-native';
// Sekme sayfaları hareket kütüphanesinin listesiyle: içindeki fotoğraf kaydırması önceliklidir (post-photos.tsx).
import { FlatList as PagerList } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { isUnread, POST_CATEGORIES, POST_TARGETS, type Announcement, type Post, type PostCategory, type PostTarget } from '@cityjoy/shared';
import type { FeedFilter } from '@cityjoy/shared/firebase';

import { AnnouncementCard } from '@/components/announcement-card';
import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { BottomNav } from '@/components/bottom-nav';
import { FormMessage } from '@/components/form-message';
import { GOLD } from '@/components/city-tiles';
import { FilterChip } from '@/components/inner';
import { LineIcon } from '@/components/line-icon';
import { RoundButton } from '@/components/hero-header';
import { PostCard } from '@/components/post-card';
import { SideMenu } from '@/components/side-menu';
import { StateMessage } from '@/components/state-message';
import { useAnnouncements } from '@/lib/announcements';
import { locationRepository as repo } from '@/lib/locations';
import { useNotificationFeed, useReadState } from '@/lib/notifications';
import { authorHref, toggleLike, toggleSave, useFeed, useLiked, useSaved } from '@/lib/posts';
import { useSession } from '@/lib/session';
import { toggleFollowAuthor, toggleFollowBusiness, useSocial } from '@/lib/social';
import { useUserLocation } from '@/lib/user-location';
import { fonts, GUTTER, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { limitText } from '@/lib/limits';

type Tag = PostCategory | 'all';
const TAGS: Tag[] = ['all', ...POST_CATEGORIES];
const TAB_ICON: Record<PostTarget, ComponentProps<typeof LineIcon>['name']> = { mahallem: 'holiday-village', bolgesel: 'place', genel: 'public', takip: 'group' };
/** Aşağı inerken üst çubuk bu kadar kayınca gizlenir; yukarı çekince bu kadar kayınca geri gelir (Eren, 7 Kasım). */
const HIDE_AFTER = 12;
const SHOW_AFTER = 60;

/**
 * Keşfet (PROJE.md 5.5; Eren'in örnek ekranı, 13. madde 30). Üstte menü, "KEŞFET" ve açık sekme, yeni gönderi ve bildirim.
 * Mahallem / Bölgesel / Genel / Takip: dört simgeli cam düğme, parmakla sağa sola kaydırınca sekme değişir. Etiketlerle
 * (#Soru, #Kayıp...) süzülür. Acil duyurular akışın en üstünde. Engellediklerimin gönderileri hiçbir sekmede görünmez.
 */
export default function ExploreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useSession();
  const [index, setIndex] = useState(0);
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]));
  const [tag, setTag] = useState<Tag>('all');
  const [menuOpen, setMenuOpen] = useState(false);
  const pager = useRef<FlatList<PostTarget>>(null);
  // Üst çubuk (başlık ve sekmeler) akış aşağı kayarken gizlenir, belirgin biçimde yukarı çekince görünür.
  const [headerH, setHeaderH] = useState(insets.top + 120);
  const hidden = useRef(new Animated.Value(0)).current;
  const shown = useRef(true);
  const lastY = useRef(0);
  const drift = useRef(0);
  const showHeader = (v: boolean) => {
    if (shown.current === v) return;
    shown.current = v;
    Animated.timing(hidden, { toValue: v ? 0 : 1, duration: 200, useNativeDriver: true }).start();
  };
  const onFeedScroll = (y: number) => {
    const d = y - lastY.current;
    lastY.current = y;
    if (y <= headerH) {
      drift.current = 0;
      return showHeader(true);
    }
    if (d > 0 !== drift.current > 0) drift.current = 0;
    drift.current += d;
    if (drift.current > HIDE_AFTER) showHeader(false);
    else if (drift.current < -SHOW_AFTER) showHeader(true);
  };
  const feed = useNotificationFeed(false);
  const [read] = useReadState();
  const hasUnread = (feed ?? []).some((n) => isUnread(n, read));
  const tab = POST_TARGETS[index];

  useEffect(() => {
    setVisited((v) => (v.has(index) ? v : new Set(v).add(index)));
    // Sekme değişince üst çubuk görünür.
    lastY.current = 0;
    drift.current = 0;
    if (!shown.current) {
      shown.current = true;
      Animated.timing(hidden, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [index, hidden]);

  const goTab = (i: number) => {
    setIndex(i);
    pager.current?.scrollToIndex({ index: i, animated: true });
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar style="light" />
      <Animated.View
        onLayout={(e) => setHeaderH(Math.round(e.nativeEvent.layout.height))}
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.xs, backgroundColor: c.hero, borderBottomColor: c.border },
          { transform: [{ translateY: hidden.interpolate({ inputRange: [0, 1], outputRange: [0, -headerH] }) }] },
        ]}>
        <View style={styles.bar}>
          <RoundButton icon="menu" label={t('menu.open')} onPress={() => setMenuOpen(true)} />
          <View style={styles.titleBox}>
            <AppText accessibilityRole="header" style={[styles.title, { color: c.heroText }]}>{t('explore.title').toLocaleUpperCase()}</AppText>
            <AppText style={[styles.subtitle, { color: c.heroAccent }]}>{t(`explore.targets.${tab}`)}</AppText>
          </View>
          <View style={styles.row}>
            {user ? <RoundButton icon="add" label={t('explore.newPost')} onPress={() => router.push({ pathname: '/explore/new', params: { target: tab } })} /> : null}
            {user ? <RoundButton icon="notifications-none" label={hasUnread ? t('notifications.titleUnread') : t('notifications.title')} onPress={() => router.push('/notifications')} badge={hasUnread} /> : null}
          </View>
        </View>
        {/* Benim Şehrim kutuları gibi simgeli cam düğmeler (Eren, 10 Kasım 2026); yana kaydırınca da sekme değişir. */}
        <View style={[styles.tabs, { marginHorizontal: GUTTER }]} accessibilityRole="tablist">
          {POST_TARGETS.map((x, i) => {
            const on = i === index;
            return (
              <Pressable
                key={x}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t(`explore.targets.${x}`)}
                onPress={() => goTab(i)}
                style={({ pressed }) => [styles.tab, on ? styles.tabOn : null, { transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
                <LineIcon name={TAB_ICON[x]} size={19} color={on ? GOLD : c.heroMuted} />
                <AppText numberOfLines={1} style={[styles.tabText, { color: on ? c.heroText : c.heroMuted, fontFamily: on ? fonts.bodySemi : fonts.bodyMedium }]}>
                  {t(`explore.targets.${x}`)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
      {/* Saat ve pil çubuğunun altı, üst çubuk gizliyken de aynı renkte kalır. */}
      <View pointerEvents="none" style={[styles.statusCover, { height: insets.top, backgroundColor: c.hero }]} />

      <PagerList
        ref={pager}
        data={POST_TARGETS as unknown as PostTarget[]}
        keyExtractor={(x) => x}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.max(0, Math.min(POST_TARGETS.length - 1, Math.round(e.nativeEvent.contentOffset.x / width))))}
        style={styles.flex}
        renderItem={({ item: x, index: i }) => (
          <View style={{ width }}>{visited.has(i) ? <FeedPage tab={x} tag={tag} onTag={setTag} active={i === index} topInset={headerH} onScrollY={i === index ? onFeedScroll : undefined} /> : null}</View>
        )}
      />
      <BottomNav active="explore" />
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

/** Bir sekmenin akışı (yalnızca açılınca okunur; sekme değiştirince önbellekten gelir). */
function FeedPage({ tab, tag, onTag, active, topInset, onScrollY }: { tab: PostTarget; tag: Tag; onTag(t: Tag): void; active: boolean; topInset: number; onScrollY?(y: number): void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { user } = useSession();
  const { location } = useUserLocation();
  const [onlyDistrict, setOnlyDistrict] = useState(false);
  const { blocked, following, followingBusinesses } = useSocial();
  const [pending, setPending] = useState<Record<string, 'istek' | undefined>>({});
  const district = location?.districtId ? repo.getDistrict(location.districtId) : undefined;
  const province = location ? repo.getProvince(location.provinceCode)?.name : undefined;

  const filter: FeedFilter | null =
    !user || !location ? null
    : tab === 'mahallem' ? (location.neighbourhoodId ? { target: 'mahallem', neighbourhoodId: location.neighbourhoodId } : null)
    : tab === 'bolgesel' ? { target: 'bolgesel', provinceCode: location.provinceCode, ...(onlyDistrict && district ? { districtId: district.id } : {}) }
    : tab === 'takip' ? (following && followingBusinesses ? { target: 'takip', authorUids: following.filter((u) => !blocked.has(u)), businessIds: followingBusinesses } : null)
    : { target: 'genel' };
  const feed = useFeed(filter);
  const { hasMore, failed, loadingMore, reload, loadMore } = feed;
  // Engellediklerimin gönderileri görünmez; etiket seçiliyse yalnızca o kategori.
  const all = feed.posts?.filter((p) => !blocked.has(p.authorUid)) ?? (tab === 'takip' && following === null ? null : feed.posts);
  const posts = all && tag !== 'all' ? all.filter((p) => p.category === tag) : all;
  const isLiked = useLiked(user?.uid);
  const isSaved = useSaved(user?.uid);
  const [, rerender] = useState(0);
  const { list: announcements } = useAnnouncements(location, 'hepsi');
  const urgent = tab === 'genel' || tab === 'takip' ? [] : (announcements ?? []).filter((a) => a.kind === 'acil');

  // Resmî duyurular (muhtar, belediye, kurum) kullanıcı gönderileriyle zaman sırasına göre karışık akar (PROJE.md 5.5,
  // Eren onayladı): Mahallem'de mahalleye ve ilçeye yönelik olanlar, Bölgesel'de hepsi. Etiket seçiliyken duyuru yok.
  const oldest = hasMore && all?.length ? all[all.length - 1].createdAt : '';
  const official =
    tag === 'all' && (tab === 'mahallem' || tab === 'bolgesel')
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
  const followOf = (uid: string) => (following?.includes(uid) ? 'aktif' : pending[uid] ?? null);
  const follow = async (uid: string) => {
    if (!user) return;
    const status = await toggleFollowAuthor(user.uid, uid, followOf(uid) === 'aktif').catch((e) => {
      const msg = limitText(t, e);
      if (msg) Alert.alert(msg);
      return undefined;
    });
    if (status !== undefined) setPending((p) => ({ ...p, [uid]: status === 'istek' ? 'istek' : undefined }));
  };
  const followBusiness = (bid: string) => user && toggleFollowBusiness(user.uid, bid, !!followingBusinesses?.includes(bid)).catch(() => {});
  const save = (id: string) => user && toggleSave(id, user.uid, isSaved(id)).catch(() => {});

  const top = (
    <View style={styles.top}>
      {/* Etiketler: kategoriye göre süzme. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsScroll} contentContainerStyle={styles.tags} accessibilityRole="tablist" accessibilityLabel={t('explore.tagsLabel')}>
        {TAGS.map((x) => (
          <FilterChip key={x} label={t(`explore.tags.${x}`)} active={x === tag} onPress={() => onTag(x)} />
        ))}
      </ScrollView>
      {tab === 'bolgesel' && district ? (
        <View style={styles.row}>
          {[{ v: false, label: province ?? '' }, { v: true, label: district.name }].map((o) => (
            <Pressable
              key={String(o.v)}
              accessibilityRole="button"
              accessibilityState={{ selected: onlyDistrict === o.v }}
              onPress={() => setOnlyDistrict(o.v)}
              style={[styles.place, { backgroundColor: onlyDistrict === o.v ? c.surfaceStrong : 'transparent', borderColor: c.border }]}>
              <AppText style={[styles.chipText, { color: onlyDistrict === o.v ? c.textStrong : c.textMuted }]}>{o.label}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
      {urgent.map((a) => (
        <AnnouncementCard key={a.id} item={a} onPress={() => router.push({ pathname: '/announcements/[id]', params: { id: a.id } })} />
      ))}
      {tab === 'takip' && following?.length === 0 && followingBusinesses?.length === 0 ? <FormMessage kind="info" text={t('explore.followHint')} /> : null}
    </View>
  );

  if (!user || !location || (tab === 'mahallem' && !location.neighbourhoodId)) {
    return (
      <View style={[styles.page, { paddingTop: topInset }]}>
        {!user ? (
          <FormMessage kind="info" text={t('explore.signIn')} />
        ) : (
          <>
            <StateMessage kind="empty" message={location ? t('explore.needNeighbourhood') : t('explore.needLocation')} />
            <AppButton title={t('home.changeLocation')} onPress={() => router.push('/location?edit=1')} />
          </>
        )}
      </View>
    );
  }

  const listProps: Partial<FlatListProps<Item>> = active ? {} : { scrollsToTop: false };
  return (
    <FlatList
      {...listProps}
      data={items ?? []}
      keyExtractor={(i) => (i.kind === 'post' ? i.post.id : `a-${i.ann.id}`)}
      // Liste üst çubuğun altından başlar; iPhone'da yenileme göstergesi de çubuğun altında görünsün diye boşluk iç boşluk olarak verilir.
      contentContainerStyle={[styles.page, Platform.OS === 'ios' ? null : { paddingTop: topInset }]}
      contentInset={Platform.OS === 'ios' ? { top: topInset } : undefined}
      contentOffset={Platform.OS === 'ios' ? { x: 0, y: -topInset } : undefined}
      scrollIndicatorInsets={Platform.OS === 'ios' ? { top: topInset } : undefined}
      onScroll={onScrollY ? (e) => onScrollY(e.nativeEvent.contentOffset.y + (Platform.OS === 'ios' ? topInset : 0)) : undefined}
      scrollEventThrottle={16}
      ListHeaderComponent={top}
      renderItem={({ item: i }) =>
        i.kind === 'ann' ? (
          <View style={styles.ann}>
            <AnnouncementCard item={i.ann} onPress={() => router.push({ pathname: '/announcements/[id]', params: { id: i.ann.id } })} />
          </View>
        ) : (
          <PostCard
            item={i.post}
            liked={isLiked(i.post.id)}
            saved={isSaved(i.post.id)}
            onSave={() => save(i.post.id)}
            // İşletme adına paylaşımda takip ve ad işletmeye gider.
            follow={i.post.authorUid === user.uid ? undefined : i.post.business ? (followingBusinesses?.includes(i.post.business.id) ? 'aktif' : null) : followOf(i.post.authorUid)}
            onFollow={() => (i.post.business ? followBusiness(i.post.business.id) : follow(i.post.authorUid))}
            onLike={() => like(i.post.id)}
            onAuthor={() => router.push(authorHref(i.post))}
          />
        )
      }
      ListEmptyComponent={
        items === null ? <StateMessage kind="loading" />
        : failed ? <StateMessage kind="error" message={t('explore.loadError')} onRetry={reload} />
        : <StateMessage kind="empty" message={tag === 'all' ? t('explore.empty') : t('explore.tagEmpty')} />
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator /> : !hasMore && all?.length ? <AppText variant="caption" muted style={styles.center}>{t('explore.end')}</AppText> : undefined}
      onEndReached={hasMore ? loadMore : undefined}
      onEndReachedThreshold={0.5}
      refreshControl={<RefreshControl refreshing={false} onRefresh={reload} progressViewOffset={topInset} />}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: { position: 'absolute', top: 0, start: 0, end: 0, zIndex: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  statusCover: { position: 'absolute', top: 0, start: 0, end: 0, zIndex: 3 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: GUTTER, minHeight: 52 },
  titleBox: { flex: 1, alignItems: 'center' },
  title: { fontFamily: fonts.headingSemi, fontSize: 17, lineHeight: 22, letterSpacing: 5 },
  subtitle: { fontSize: 12, lineHeight: 16, marginTop: 1 },
  row: { flexDirection: 'row', gap: spacing.xs },
  tabs: { flexDirection: 'row', gap: 6, marginBottom: spacing.sm },
  tab: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: radius.lg, borderWidth: 1, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderColor: 'rgba(255, 255, 255, 0.12)', borderTopColor: 'rgba(255, 255, 255, 0.22)' },
  tabOn: { backgroundColor: 'rgba(226, 178, 119, 0.16)', borderColor: 'rgba(226, 178, 119, 0.7)', borderTopColor: 'rgba(226, 178, 119, 0.7)' },
  tabText: { fontSize: 12.5 },
  page: { paddingHorizontal: GUTTER, paddingBottom: spacing.xl },
  top: { gap: spacing.sm, paddingTop: spacing.sm },
  tagsScroll: { marginHorizontal: -GUTTER, flexGrow: 0 },
  tags: { paddingHorizontal: GUTTER, gap: spacing.sm },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  place: { minHeight: 32, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  ann: { paddingVertical: spacing.sm },
  center: { textAlign: 'center', paddingTop: spacing.md },
});
