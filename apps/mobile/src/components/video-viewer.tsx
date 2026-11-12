import { MaterialIcons } from '@expo/vector-icons';
import { VideoView } from 'expo-video';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Animated, FlatList, I18nManager, Modal, PanResponder, Pressable, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { Post } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { AvatarPhoto } from '@/components/avatar-photo';
import { PostSheet } from '@/components/post-sheet';
import { useResumingPlayer } from '@/components/post-video';
import { useReduceMotion } from '@/components/scene-art';
import { useAuthor, useBusinessInfo } from '@/lib/profile-photos';
import { fonts, radius, spacing } from '@/theme/tokens';

type Follow = 'aktif' | 'istek' | null | undefined;
type IconName = ComponentProps<typeof MaterialIcons>['name'];

interface Props {
  /** Akıştaki videolu gönderiler, akıştaki sırayla. */
  posts: Post[];
  /** Açılacak gönderi; null ise kapalı. */
  startId: string | null;
  onClose(): void;
  isLiked(id: string): boolean;
  onLike(p: Post): void;
  isSaved(id: string): boolean;
  onSave(p: Post): void;
  followOf(p: Post): Follow;
  onFollow(p: Post): void;
  onAuthor(p: Post): void;
  /** Akışta daha fazla gönderi var mı (sona gelince yenileri istenir). */
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?(): void;
}

type Page = { kind: 'post'; post: Post } | { kind: 'loading' } | { kind: 'end' };
// Sona gelince en çok bu kadar sayfa (20'şer gönderi) üst üste video aranır; bulunmazsa "başka video yok" (okuma maliyeti).
const MAX_EMPTY_LOADS = 3;

const DOUBLE_TAP_MS = 260;
const WHITE = '#FFFFFF';
const SHADE = [0.04, 0.1, 0.18, 0.28, 0.4, 0.52];

/**
 * Tam ekran video (Eren, 12 Kasım 2026, Instagram örneği): akışta videoya bir kez dokununca açılır. Siyah zeminde video
 * sesli ve döngüde, akışta kaldığı yerden oynar; yukarı kaydırınca sonraki video (sona gelince akıştan yenileri yüklenir),
 * soldan sağa kaydırınca kapanır. Bir dokunuş durdurur/oynatır, iki dokunuş beğenir.
 * Sol üstte geri; sağda beğen, yorum, paylaş, kaydet; altta paylaşan, Takip et, açıklama, ilerleme çizgisi ve
 * "Yorum ekle..." (yorumlar penceresi açılır). Yalnızca açık sayfanın oynatıcısı vardır (veri maliyeti).
 */
export function VideoViewer({ posts, startId, onClose, hasMore, loadingMore, onLoadMore, ...rest }: Props) {
  const { t } = useTranslation();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const start = Math.max(0, posts.findIndex((p) => p.id === startId));
  const [index, setIndex] = useState(start);
  useEffect(() => {
    if (startId) setIndex(start);
  }, [startId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Instagram gibi: son videoya yaklaşınca akıştan yeni gönderiler istenir; yeni sayfada video yoksa birkaç sayfa daha.
  const emptyLoads = useRef(0);
  const lastCount = useRef(posts.length);
  if (posts.length !== lastCount.current) {
    lastCount.current = posts.length;
    emptyLoads.current = 0;
  }
  const searching = !!hasMore && emptyLoads.current < MAX_EMPTY_LOADS;
  useEffect(() => {
    if (!startId || !searching || loadingMore || index < posts.length - 2) return;
    emptyLoads.current += 1;
    onLoadMore?.();
  }, [startId, searching, loadingMore, index, posts.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const pages: Page[] = [...posts.map((post) => ({ kind: 'post' as const, post })), searching ? { kind: 'loading' } : { kind: 'end' }];

  // Soldan sağa kaydırınca (Arapçada sağdan sola) tam ekran kapanır, arkada akış görünür.
  const dir = I18nManager.isRTL ? -1 : 1;
  const dx = useRef(new Animated.Value(0)).current;
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (startId) dx.setValue(0);
  }, [startId, dx]);
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => dir * g.dx > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => dx.setValue(Math.max(0, dir * g.dx) * dir),
      onPanResponderRelease: (_, g) => {
        if (dir * g.dx > width * 0.3 || dir * g.vx > 0.6) {
          Animated.timing(dx, { toValue: dir * width, duration: 180, useNativeDriver: true }).start(() => close.current());
        } else {
          Animated.spring(dx, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
        }
      },
      onPanResponderTerminate: () => Animated.spring(dx, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;

  return (
    <Modal visible={!!startId} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent supportedOrientations={['portrait']}>
      <StatusBar style="light" />
      <Animated.View
        {...swipe.panHandlers}
        accessibilityHint={t('explore.video.swipeClose')}
        style={[styles.root, { transform: [{ translateX: dx }], opacity: dx.interpolate({ inputRange: [-width, 0, width], outputRange: [0.6, 1, 0.6] }) }]}>
        {startId ? (
          <FlatList
            data={pages}
            keyExtractor={(p) => (p.kind === 'post' ? p.post.id : p.kind)}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            initialScrollIndex={start}
            getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
            onMomentumScrollEnd={(e) => setIndex(Math.max(0, Math.min(pages.length - 1, Math.round(e.nativeEvent.contentOffset.y / height))))}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            windowSize={3}
            renderItem={({ item, index: i }) => (
              <View style={{ width, height }}>
                {item.kind === 'post' ? (
                  <Reel post={item.post} active={i === index} onClose={onClose} {...rest} />
                ) : item.kind === 'loading' ? (
                  <View style={styles.center}>
                    <ActivityIndicator color={WHITE} accessibilityLabel={t('common.loading')} />
                  </View>
                ) : (
                  <View style={[styles.center, styles.endPage, { paddingBottom: insets.bottom }]}>
                    <MaterialIcons name="video-library" size={44} color="rgba(255,255,255,0.7)" />
                    <AppText style={styles.endText}>{t('explore.video.end')}</AppText>
                    <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.endBtn, { opacity: pressed ? 0.7 : 1 }]}>
                      <AppText style={styles.followText}>{t('explore.video.backToFeed')}</AppText>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          />
        ) : null}
      </Animated.View>
    </Modal>
  );
}

function Reel({ post: given, active, onClose, isLiked, onLike, isSaved, onSave, followOf, onFollow, onAuthor }: Omit<Props, 'posts' | 'startId'> & { post: Post; active: boolean }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  // Yorum penceresindeki değişiklik (yorum sayısı) hemen görünür.
  const [changed, setChanged] = useState<Post | null>(null);
  const post = changed && changed.id === given.id ? { ...given, commentCount: changed.commentCount, commentsOff: changed.commentsOff } : given;
  const [sheet, setSheet] = useState<'list' | 'input' | null>(null);
  const [paused, setPaused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const heart = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const lastTap = useRef(0);
  const single = useRef<ReturnType<typeof setTimeout>>(undefined);
  const author = useAuthor(post.business ? undefined : post.authorUid);
  const biz = useBusinessInfo(post.business?.id);
  const name = (post.business ? biz.name : author.displayName) || post.authorName;
  const liked = isLiked(post.id);
  const saved = isSaved(post.id);
  const follow = followOf(post);

  useEffect(() => {
    if (!active) setPaused(false);
  }, [active]);
  useEffect(() => () => clearTimeout(single.current), []);

  const popHeart = () => {
    heart.setValue(reduce ? 1 : 0);
    if (reduce) return void setTimeout(() => heart.setValue(0), 600);
    Animated.sequence([
      Animated.spring(heart, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
      Animated.delay(350),
      Animated.timing(heart, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };
  const tap = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      clearTimeout(single.current);
      lastTap.current = 0;
      popHeart();
      if (!liked) onLike(post);
      return;
    }
    lastTap.current = now;
    single.current = setTimeout(() => setPaused((p) => !p), DOUBLE_TAP_MS);
  };
  const share = () => Share.share({ message: `${name}: ${post.text}\n\nCityJoy` }).catch(() => {});
  const followLabel = follow === 'aktif' ? t('explore.profile.following') : follow === 'istek' ? t('explore.profile.requestedShort') : t('explore.profile.follow');

  const side = (icon: IconName, label: string, onPress: () => void, color = WHITE, count?: number) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={({ pressed }) => [styles.sideBtn, { opacity: pressed ? 0.6 : 1 }]}>
      <MaterialIcons name={icon} size={30} color={color} style={styles.iconShadow} />
      {count !== undefined ? <AppText style={styles.sideCount}>{count}</AppText> : null}
    </Pressable>
  );

  return (
    <View style={styles.reel}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={paused ? t('explore.video.resume') : t('explore.video.pause')}
        accessibilityHint={t('explore.doubleTapHint')}
        onPress={tap}
        style={StyleSheet.absoluteFill}>
        {active ? <ReelVideo url={post.video!.url} paused={paused} progress={progress} /> : null}
      </Pressable>
      {paused ? (
        <View pointerEvents="none" style={styles.center}>
          <View style={styles.bigPlay}>
            <MaterialIcons name="play-arrow" size={48} color={WHITE} />
          </View>
        </View>
      ) : null}
      <Animated.View pointerEvents="none" style={[styles.center, { opacity: heart, transform: [{ scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }]}>
        <MaterialIcons name="favorite" size={96} color="#FF4D5E" />
      </Animated.View>

      {/* Alt yazıların okunması için aşağıya doğru koyulaşan gölge. */}
      <View pointerEvents="none" style={styles.shade}>
        {SHADE.map((o) => (
          <View key={o} style={[styles.flex, { backgroundColor: `rgba(0,0,0,${o})` }]} />
        ))}
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={onClose} hitSlop={8} style={[styles.back, { top: insets.top + spacing.xs }]}>
        <MaterialIcons name="arrow-back" size={26} color={WHITE} style={styles.iconShadow} />
      </Pressable>

      <View style={[styles.sideCol, { bottom: insets.bottom + 120 }]}>
        {side(liked ? 'favorite' : 'favorite-border', liked ? t('explore.unlike') : t('explore.like'), () => onLike(post), liked ? '#FF4D5E' : WHITE, post.likeCount)}
        {side('chat-bubble-outline', t('explore.comments.title', { count: post.commentCount }), () => setSheet('list'), WHITE, post.commentCount)}
        {side('send', t('explore.share'), share)}
        {side(saved ? 'bookmark' : 'bookmark-border', saved ? t('explore.unsave') : t('explore.save'), () => onSave(post))}
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.sm }]}>
        <View style={styles.authorRow}>
          <Pressable accessibilityRole="link" accessibilityLabel={t('explore.profile.open', { name })} onPress={() => onAuthor(post)} style={styles.author}>
            <View style={styles.avatar}>
              <AppText style={styles.initial}>{(name || '?').slice(0, 1).toLocaleUpperCase()}</AppText>
              <AvatarPhoto uid={post.business ? undefined : post.authorUid} size={34} />
            </View>
            <AppText numberOfLines={1} style={styles.name}>{name}</AppText>
            {post.business && biz.verified ? <MaterialIcons name="verified" size={15} color={WHITE} accessibilityLabel={t('explore.verifiedBusiness')} /> : null}
          </Pressable>
          {follow !== undefined ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`${followLabel}: ${name}`} onPress={() => onFollow(post)} hitSlop={6} style={({ pressed }) => [styles.follow, follow === 'aktif' && styles.followOn, { opacity: pressed ? 0.7 : 1 }]}>
              <AppText style={styles.followText}>{followLabel}</AppText>
            </Pressable>
          ) : null}
        </View>
        {post.text ? (
          <AppText onPress={() => setExpanded((v) => !v)} numberOfLines={expanded ? 8 : 2} style={styles.caption}>
            {post.text}
          </AppText>
        ) : null}
        <View style={styles.track} accessibilityLabel={t('explore.video.progress')}>
          <Animated.View style={[styles.fill, { transform: [{ scaleX: progress }] }]} />
        </View>
        <Pressable accessibilityRole="button" onPress={() => setSheet('input')} style={({ pressed }) => [styles.addComment, { opacity: pressed ? 0.75 : 1 }]}>
          <AppText style={styles.addCommentText}>{post.commentsOff ? t('explore.comments.off') : t('explore.comments.add')}</AppText>
        </Pressable>
      </View>

      <PostSheet
        item={post}
        open={sheet !== null}
        focusInput={sheet === 'input' && !post.commentsOff}
        onClose={() => setSheet(null)}
        onChange={setChanged}
        onRemoved={() => {
          setSheet(null);
          onClose();
        }}
      />
    </View>
  );
}

/** Açık sayfanın oynatıcısı: sesli, döngüde, akışta kaldığı saniyeden sürer; ilerlemeyi ekranı yeniden çizmeden çizgiye yazar. */
function ReelVideo({ url, paused, progress }: { url: string; paused: boolean; progress: Animated.Value }) {
  const player = useResumingPlayer(url, (p) => {
    p.loop = true;
    p.muted = false;
  });
  useEffect(() => {
    progress.setValue(0);
    const sub = player.addListener('timeUpdate', (e) => progress.setValue(player.duration > 0 ? Math.min(1, e.currentTime / player.duration) : 0));
    return () => sub.remove();
  }, [player, progress]);
  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [player, paused]);
  return <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="contain" pointerEvents="none" />;
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 } as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  flex: { flex: 1 },
  reel: { flex: 1, backgroundColor: '#000000' },
  center: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center', justifyContent: 'center' },
  bigPlay: { width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  shade: { position: 'absolute', start: 0, end: 0, bottom: 0, height: 280 },
  iconShadow: shadow,
  back: { position: 'absolute', start: spacing.sm, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sideCol: { position: 'absolute', end: spacing.sm, alignItems: 'center', gap: spacing.md },
  sideBtn: { alignItems: 'center', minWidth: 48, minHeight: 48, justifyContent: 'center' },
  sideCount: { color: WHITE, fontFamily: fonts.bodySemi, fontSize: 13, marginTop: 2, ...shadow },
  bottom: { position: 'absolute', start: 0, end: 0, bottom: 0, paddingStart: spacing.md, paddingEnd: 72, gap: spacing.sm },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1, minHeight: 44 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: { color: WHITE, fontFamily: fonts.heading, fontSize: 14 },
  name: { flexShrink: 1, color: WHITE, fontFamily: fonts.bodySemi, fontSize: 15, ...shadow },
  follow: { minHeight: 30, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', justifyContent: 'center' },
  followOn: { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'transparent' },
  followText: { color: WHITE, fontFamily: fonts.bodySemi, fontSize: 13 },
  caption: { color: WHITE, fontSize: 14, lineHeight: 20, ...shadow },
  track: { height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginEnd: -56, overflow: 'hidden' },
  // Çizgi soldan dolar (Arapçada sağdan): ölçek başlangıç kenarından.
  fill: { height: 2, backgroundColor: WHITE, width: '100%', transformOrigin: I18nManager.isRTL ? 'right' : 'left' },
  addComment: { minHeight: 42, marginEnd: -56, borderRadius: 21, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', paddingHorizontal: spacing.md, justifyContent: 'center' },
  addCommentText: { color: 'rgba(255,255,255,0.75)', fontSize: 14 },
  endPage: { gap: spacing.md, paddingHorizontal: spacing.xl },
  endText: { color: WHITE, fontFamily: fonts.bodySemi, fontSize: 16, textAlign: 'center' },
  endBtn: { minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', justifyContent: 'center' },
});
