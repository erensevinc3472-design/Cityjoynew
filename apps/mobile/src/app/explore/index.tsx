import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Alert, Animated, FlatList, I18nManager, Platform, Pressable, RefreshControl, StyleSheet, View, useWindowDimensions, type FlatListProps } from 'react-native';
// Sekme sayfaları hareket kütüphanesinin listesiyle: içindeki fotoğraf kaydırması önceliklidir (post-photos.tsx).
import { FlatList as PagerList, ScrollView as ChipScroll } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { isUnread, POST_TARGETS, rankFeed, type Announcement, type Post, type PostCategory, type PostTarget } from '@cityjoy/shared';
import type { FeedFilter } from '@cityjoy/shared/firebase';

import { AnnouncementCard } from '@/components/announcement-card';
import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { BottomNav } from '@/components/bottom-nav';
import { FeedSortButton } from '@/components/feed-sort-button';
import { FormMessage } from '@/components/form-message';
import { GOLD } from '@/components/city-tiles';
import { LineIcon } from '@/components/line-icon';
import { RoundButton } from '@/components/hero-header';
import { PostCard } from '@/components/post-card';
import { SideMenu } from '@/components/side-menu';
import { VideoViewer } from '@/components/video-viewer';
import { StateMessage } from '@/components/state-message';
import { useAnnouncements } from '@/lib/announcements';
import { useAutoplayAllowed } from '@/lib/autoplay';
import { useFeedSort } from '@/lib/feed-sort';
import { useNotificationFeed, useReadState } from '@/lib/notifications';
import { authorHref, toggleLike, toggleSave, useFeed, useLiked, useSaved } from '@/lib/posts';
import { markSeen } from '@/lib/recent-posts';
import { useSession } from '@/lib/session';
import { toggleFollowAuthor, toggleFollowBusiness, useSocial } from '@/lib/social';
import { useUserLocation } from '@/lib/user-location';
import { fonts, GUTTER, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { limitText } from '@/lib/limits';

type Tag = PostCategory | 'all';
/**
 * Her bölümün kendi süzgeçleri (Eren, 12 Kasım 2026: "her bölüm için gerekli olanlar"). Mahallem komşuluk (yardım,
 * kayıp, taziye), Bölgesel şehir hayatı (etkinlik, fırsat, duyuru), Genel ülke geneli gündem (haber, ekonomi, spor, teknoloji, kültür-sanat, sağlık, yardım; sağa sola kayar), Takip'te süzgeç yok.
 * Paylaşırken bütün türler (POST_CATEGORIES) seçilebilir; bu yalnızca okurken süzmek içindir.
 */
const TAB_TAGS: Record<PostTarget, Tag[]> = {
  mahallem: ['all', 'soru-yardim', 'kayip-buluntu', 'taziye'],
  bolgesel: ['all', 'etkinlik', 'firsat', 'duyuru'],
  genel: ['all', 'haber', 'ekonomi', 'spor', 'teknoloji', 'kultur-sanat', 'saglik', 'soru-yardim'],
  takip: [],
};
const TAB_ICON: Record<PostTarget, ComponentProps<typeof LineIcon>['name']> = { mahallem: 'holiday-village', bolgesel: 'place', genel: 'public', takip: 'group' };
/** Aşağı inerken üst çubuk bu kadar kayınca gizlenir; yukarı çekince bu kadar kayınca geri gelir (Eren, 7 Kasım). */
const HIDE_AFTER = 12;
const SHOW_AFTER = 60;

/**
 * Keşfet (PROJE.md 5.5; Eren'in örnek ekranı, 13. madde 30). Üstte menü, "KEŞFET" ve açık sekme, yeni gönderi ve bildirim.
 * Mahallem / Bölgesel / Genel / Takip: dört simgeli cam düğme, parmakla sağa sola kaydırınca sekme değişir. Etiketlerle
 * (#Soru, #Kayıp...) süzülür. Acil duyurular akışın en üstünde. Engellediklerimin gönderileri hiçbir sekmede görünmez.
 */
/** Uygulama açık kaldıkça son seçilen Keşfet sekmesi. */
let lastTab = 0;

export default function ExploreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useSession();
  // Son açık sekme hatırlanır: başka sayfaya gidip dönünce aynı sekmeden devam eder (Eren, 13 Kasım 2026).
  const [index, setIndexState] = useState(lastTab);
  const setIndex = (i: number) => {
    lastTab = i;
    setIndexState(i);
  };
  // Açık sekme ve yanındakiler hazır tutulur: kaydırırken boş sayfa görünmez.
  const [visited, setVisited] = useState<Set<number>>(() => new Set([lastTab - 1, lastTab, lastTab + 1].filter((i) => i >= 0 && i < POST_TARGETS.length)));
  // Sekme çubuğundaki altın gösterge parmağı izler (sayfa kaydıkça kayar).
  const scrollX = useRef(new Animated.Value(lastTab * width)).current;
  const [tabsW, setTabsW] = useState(0);
  const rtl = I18nManager.isRTL;
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
    setVisited((v) => {
      const want = [index - 1, index, index + 1].filter((i) => i >= 0 && i < POST_TARGETS.length && !v.has(i));
      return want.length ? new Set([...v, ...want]) : v;
    });
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
          <View style={styles.row}>
            <RoundButton icon="menu" label={t('menu.open')} onPress={() => setMenuOpen(true)} />
            {user ? <FeedSortButton /> : null}
          </View>
          <View style={styles.titleBox}>
            <AppText accessibilityRole="header" style={[styles.title, { color: c.heroText }]}>{t('explore.title').toLocaleUpperCase()}</AppText>
            <AppText style={[styles.subtitle, { color: c.heroAccent }]}>{t(`explore.targets.${tab}`)}</AppText>
          </View>
          <View style={styles.row}>
            {user ? <RoundButton icon="add" label={t('explore.newPost')} onPress={() => router.push({ pathname: '/explore/new', params: { target: tab } })} /> : null}
            {user ? <RoundButton icon="notifications-none" label={hasUnread ? t('notifications.titleUnread') : t('notifications.title')} onPress={() => router.push('/notifications')} badge={hasUnread} /> : null}
          </View>
        </View>
        {/* Tek parça sekme çubuğu (Eren, 12 Kasım 2026): dört bölüm aynı kutuda, altın gösterge parmakla birlikte kayar. */}
        <View
          style={[styles.tabs, { marginHorizontal: GUTTER }]}
          accessibilityRole="tablist"
          onLayout={(e) => setTabsW(e.nativeEvent.layout.width)}>
          {tabsW ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.indicator,
                {
                  width: (tabsW - 10) / POST_TARGETS.length,
                  transform: [{ translateX: scrollX.interpolate({ inputRange: [0, width], outputRange: [0, ((tabsW - 10) / POST_TARGETS.length) * (rtl ? -1 : 1)] }) }],
                },
              ]}
            />
          ) : null}
          {POST_TARGETS.map((x, i) => {
            const on = i === index;
            return (
              <Pressable
                key={x}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t(`explore.targets.${x}`)}
                onPress={() => goTab(i)}
                style={styles.tab}>
                <LineIcon name={TAB_ICON[x]} size={18} color={on ? GOLD : c.heroMuted} />
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
        initialScrollIndex={index}
        onScroll={(e) => scrollX.setValue(e.nativeEvent.contentOffset.x)}
        scrollEventThrottle={16}
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => setIndex(Math.max(0, Math.min(POST_TARGETS.length - 1, Math.round(e.nativeEvent.contentOffset.x / width))))}
        style={styles.flex}
        renderItem={({ item: x, index: i }) => (
          <View style={{ width }}>{visited.has(i) ? <FeedPage tab={x} active={i === index} topInset={headerH} onScrollY={i === index ? onFeedScroll : undefined} /> : null}</View>
        )}
      />
      <BottomNav active="explore" />
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

/** Bir sekmenin akışı (yalnızca açılınca okunur; sekme değiştirince önbellekten gelir). */
function FeedPage({ tab, active, topInset, onScrollY }: { tab: PostTarget; active: boolean; topInset: number; onScrollY?(y: number): void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { user } = useSession();
  const { location } = useUserLocation();
  const [tag, setTag] = useState<Tag>('all');
  const tags = TAB_TAGS[tab];
  const { blocked, following, followingBusinesses, teamBusinesses } = useSocial();
  const [pending, setPending] = useState<Record<string, 'istek' | undefined>>({});

  const filter: FeedFilter | null =
    !user || !location ? null
    : tab === 'mahallem' ? (location.neighbourhoodId ? { target: 'mahallem', neighbourhoodId: location.neighbourhoodId } : null)
    : tab === 'bolgesel' ? { target: 'bolgesel', provinceCode: location.provinceCode }
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
  const sort = useFeedSort();
  // Otomatik oynatma (Eren, 12 Kasım 2026): ekranda en az %60'ı görünen ilk videolu gönderi oynar; sekme açık değilse,
  // başka ekrana geçildiyse ya da tam ekran açıksa hiçbiri oynamaz.
  // Aşağı çekip yenileme: yeni gönderiler gelene kadar üstte dönen işaret görünür.
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  };
  const [visibleVideo, setVisibleVideo] = useState<string | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const autoplayOk = useAutoplayAllowed();
  const playing = active && focused && !viewer && autoplayOk;
  // Son gördüklerin: akışta en az 2,5 saniye ekranda (%60) kalan gönderi listeye girer (yalnız telefonda tutulur).
  const uidRef = useRef(user?.uid);
  uidRef.current = user?.uid;
  const dwell = useRef(new Map<string, ReturnType<typeof setTimeout>>()).current;
  useEffect(() => () => dwell.forEach(clearTimeout), [dwell]);
  const onViewable = useRef(({ viewableItems }: { viewableItems: { item: unknown; isViewable: boolean }[] }) => {
    const hit = viewableItems.find((v) => {
      const i = v.item as { kind: string; post?: Post };
      return v.isViewable && i.kind === 'post' && !!i.post?.video;
    });
    setVisibleVideo(hit ? (hit.item as { post: Post }).post.id : null);
    const now = new Map<string, Post>();
    viewableItems.forEach((v) => {
      const i = v.item as { kind: string; post?: Post };
      if (v.isViewable && i.kind === 'post' && i.post) now.set(i.post.id, i.post);
    });
    dwell.forEach((timer, id) => {
      if (!now.has(id)) {
        clearTimeout(timer);
        dwell.delete(id);
      }
    });
    now.forEach((p, id) => {
      if (dwell.has(id)) return;
      dwell.set(
        id,
        setTimeout(() => {
          const uid = uidRef.current;
          if (uid) markSeen(uid, p).catch(() => {});
        }, 2500),
      );
    });
  }).current;
  const viewability = useRef({ itemVisiblePercentThreshold: 60, minimumViewTime: 150 }).current;
  const urgent = tab === 'genel' || tab === 'takip' ? [] : (announcements ?? []).filter((a) => a.kind === 'acil');

  // Resmî duyurular (muhtar, belediye, kurum) kullanıcı gönderileriyle zaman sırasına göre karışık akar (PROJE.md 5.5,
  // Eren onayladı): Mahallem'de mahalleye ve ilçeye yönelik olanlar, Bölgesel'de hepsi. Etiket seçiliyken duyuru yok.
  const oldest = hasMore && all?.length ? all[all.length - 1].createdAt : '';
  const official =
    tag === 'all' && (tab === 'mahallem' || tab === 'bolgesel')
      ? (announcements ?? []).filter(
          (a) =>
            a.kind !== 'acil' && (a.publishedAt ?? '') >= oldest &&
            (tab === 'bolgesel' || !!a.region.districtId),
        )
      : [];
  type Item = { kind: 'post'; post: Post; at: string } | { kind: 'ann'; ann: Announcement; at: string };
  const byTime: Item[] | null = posts
    ? [...posts.map((p) => ({ kind: 'post' as const, post: p, at: p.createdAt })), ...official.map((a) => ({ kind: 'ann' as const, ann: a, at: a.publishedAt ?? '' }))].sort(
        (a, b) => b.at.localeCompare(a.at),
      )
    : null;
  // "Senin için" (Eren, 12 Kasım 2026, A seçeneği): okunan sayfa telefonda açık kurallarla sıralanır (@cityjoy/shared feed-rank).
  // "En yeni" zaman sırası. Acil duyurular her iki durumda da en üstte (yukarıdaki `top`).
  // Sıra yalnızca liste ya da seçim değişince hesaplanır: beğenince kart parmağın altından kaçmaz.
  const keyOf = (i: Item) => (i.kind === 'post' ? i.post.id : `a-${i.ann.id}`);
  const idsKey = byTime ? byTime.map(keyOf).join('|') : '';
  const order = useMemo(
    () =>
      byTime && sort === 'senin-icin'
        ? new Map(rankFeed(
          byTime,
          (i) =>
            i.kind === 'ann'
              ? { at: i.at, authorKey: `ann-${i.ann.id}`, official: true }
              : {
                  at: i.at,
                  authorKey: i.post.business ? `b-${i.post.business.id}` : i.post.authorUid,
                  likes: i.post.likeCount,
                  comments: i.post.commentCount,
                  reports: i.post.cleared ? 0 : i.post.reportCount,
                  followed: i.post.business ? !!followingBusinesses?.includes(i.post.business.id) : !!following?.includes(i.post.authorUid),
                  nearby: !!location?.neighbourhoodId && i.post.region.neighbourhoodId === location.neighbourhoodId,
                },
          Date.now(),
        ).map((i, n) => [keyOf(i), n]))
        : null,
    [idsKey, sort], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const items: Item[] | null = byTime && order ? [...byTime].sort((a, b) => (order.get(keyOf(a)) ?? 0) - (order.get(keyOf(b)) ?? 0)) : byTime;

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
      {/* Bölümün kendi süzgeçleri, tek satırda eşit genişlikte (yana kaymaz, sayfa kaydırmasına takılmaz). */}
      {tags.length ? (
        (() => {
          // Kutusuz, alt çizgili yazı sekmeleri (Eren, 12 Kasım 2026: "daha modern"). Az süzgeçte eşit genişlik; Genel gibi çok süzgeçte sağa sola kayar.
          const slide = tags.length > 4;
          const chips = tags.map((x) => {
            const on = x === tag;
            return (
              <Pressable
                key={x}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => setTag(x)}
                style={({ pressed }) => [styles.chip, slide && styles.chipSlide, { opacity: pressed ? 0.7 : 1 }]}>
                <AppText numberOfLines={1} adjustsFontSizeToFit={!slide} style={[styles.chipText, { color: on ? c.textStrong : c.textMuted, fontFamily: on ? fonts.bodySemi : fonts.bodyMedium }]}>{t(`explore.tags.${x}`)}</AppText>
                <View style={[styles.chipBar, { backgroundColor: on ? GOLD : 'transparent' }]} />
              </Pressable>
            );
          });
          return slide ? (
            <ChipScroll horizontal showsHorizontalScrollIndicator={false} style={[styles.slideScroll, { borderBottomColor: c.border }]} contentContainerStyle={styles.slideRow} accessibilityRole="tablist" accessibilityLabel={t('explore.tagsLabel')}>
              {chips}
            </ChipScroll>
          ) : (
            <View style={[styles.tags, { borderBottomColor: c.border }]} accessibilityRole="tablist" accessibilityLabel={t('explore.tagsLabel')}>
              {chips}
            </View>
          );
        })()
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
  const videoPosts = (items ?? []).flatMap((i) => (i.kind === 'post' && i.post.video ? [i.post] : []));
  const followFor = (p: Post) => (p.authorUid === user.uid || (p.business && teamBusinesses.includes(p.business.id)) ? undefined : p.business ? (followingBusinesses?.includes(p.business.id) ? 'aktif' : null) : followOf(p.authorUid));
  const followTap = (p: Post) => (p.business ? followBusiness(p.business.id) : follow(p.authorUid));
  return (
    <>
      <FlatList
        {...listProps}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={viewability}
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
              follow={followFor(i.post)}
              onFollow={() => followTap(i.post)}
              videoActive={playing && i.post.id === visibleVideo}
              onOpenVideo={() => {
                setViewer(i.post.id);
                markSeen(user.uid, i.post).catch(() => {});
              }}
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
        // Akıcılık: ilk açılışta az kart çizilir, ekrandan uzak kartlar bellekten çıkar.
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} progressViewOffset={topInset} />}
      />
      <VideoViewer
        posts={videoPosts}
        startId={viewer}
        onClose={() => setViewer(null)}
        isLiked={isLiked}
        onLike={(p) => like(p.id)}
        isSaved={isSaved}
        onSave={(p) => save(p.id)}
        followOf={followFor}
        onFollow={followTap}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
        onAuthor={(p) => {
          setViewer(null);
          router.push(authorHref(p));
        }}
      />
    </>
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
  tabs: { flexDirection: 'row', padding: 4, marginBottom: spacing.sm, borderRadius: radius.lg, borderWidth: 1, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderColor: 'rgba(255, 255, 255, 0.12)' },
  indicator: { position: 'absolute', top: 4, bottom: 4, start: 4, borderRadius: radius.md, borderWidth: 1, backgroundColor: 'rgba(226, 178, 119, 0.16)', borderColor: 'rgba(226, 178, 119, 0.7)' },
  tab: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabText: { fontSize: 12.5 },
  page: { paddingHorizontal: GUTTER, paddingBottom: spacing.xl },
  top: { gap: spacing.sm, paddingTop: spacing.sm },
  tags: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  slideScroll: { marginHorizontal: -GUTTER, flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  slideRow: { paddingHorizontal: GUTTER - 4, gap: 4 },
  chipSlide: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', paddingHorizontal: 12 },
  chip: { flex: 1, minHeight: 40, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'flex-end' },
  chipText: { fontSize: 14, paddingBottom: 8 },
  chipBar: { alignSelf: 'stretch', height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3, marginBottom: -StyleSheet.hairlineWidth },
  ann: { paddingVertical: spacing.sm },
  center: { textAlign: 'center', paddingTop: spacing.md },
});
