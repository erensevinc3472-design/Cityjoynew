import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useRef, type ComponentProps } from 'react';
import { Animated, Pressable, Share, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Post } from '@cityjoy/shared';

import { AvatarPhoto } from '@/components/avatar-photo';
import { AppText } from '@/components/app-text';
import { PostPhotos } from '@/components/post-photos';
import { useReduceMotion } from '@/components/scene-art';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { fonts, GUTTER, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

interface Props {
  item: Post;
  liked: boolean;
  /** Akışta yazının başı; ayrıntıda tamamı. */
  full?: boolean;
  onPress?(): void;
  onLike?(): void;
  /** Paylaşanın Keşfet profili. */
  onAuthor?(): void;
  /** Takip düğmesi: 'aktif' takiptesin, 'istek' istek gönderildi, null takip etmiyorsun; undefined ise düğme yok. */
  follow?: 'aktif' | 'istek' | null;
  onFollow?(): void;
  /** Kaydet işareti; onSave yoksa görünmez. */
  saved?: boolean;
  onSave?(): void;
}

type IconName = ComponentProps<typeof MaterialIcons>['name'];
const DOUBLE_TAP_MS = 260;

/** "şimdi", "5 dk", "3 sa", "2 g"; bir haftadan eskiyse tarih. */
export function useRelativeTime() {
  const { t } = useTranslation();
  const { language } = useSettings();
  return (iso: string) => {
    if (!iso) return '';
    const at = new Date(iso);
    const min = Math.floor((Date.now() - at.getTime()) / 60000);
    if (min < 1) return t('time.now');
    if (min < 60) return t('time.minutes', { count: min });
    if (min < 60 * 24) return t('time.hours', { count: Math.floor(min / 60) });
    if (min < 60 * 24 * 7) return t('time.days', { count: Math.floor(min / 1440) });
    return at.toLocaleDateString(language ?? 'tr', { day: 'numeric', month: 'short' });
  };
}

/**
 * Keşfet gönderisi (Instagram hissi; Eren'in örnek ekranı, 13. madde 30): çerçevesiz, ekran genişliğinde. Üstte halkalı
 * harf, ad, yer ve zaman, sağda Takip et; ortada yazı (kısa yazı büyük harfle); altta beğeni, yorum, paylaş ve kaydet;
 * en altta kategori etiketi. Fotoğraf varsa ekran genişliğinde üstte durur, yazı altında. Yazıya ya da fotoğrafa iki kez dokunmak beğenir (kalp belirir), bir kez dokunmak gönderiyi açar.
 */
export function PostCard({ item, liked, full, onPress, onLike, onAuthor, follow, onFollow, saved, onSave }: Props) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const reduce = useReduceMotion();
  const ago = useRelativeTime();
  const district = repo.getDistrict(item.region.districtId)?.name;
  const heart = useRef(new Animated.Value(0)).current;
  const bump = useRef(new Animated.Value(1)).current;
  const lastTap = useRef(0);
  const single = useRef<ReturnType<typeof setTimeout>>(undefined);
  const photos = item.photos ?? [];
  // Kısa yazı büyük harfle; fotoğraflı gönderide yazı fotoğrafın altında açıklama olur.
  const short = !full && !photos.length && item.text.length <= 140;

  useEffect(() => () => clearTimeout(single.current), []);

  const popHeart = () => {
    heart.setValue(0);
    if (reduce) {
      heart.setValue(1);
      setTimeout(() => heart.setValue(0), 600);
      return;
    }
    Animated.sequence([
      Animated.spring(heart, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
      Animated.delay(350),
      Animated.timing(heart, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };
  const pressLike = () => {
    if (!onLike) return;
    if (!reduce) Animated.sequence([Animated.timing(bump, { toValue: 1.25, duration: 90, useNativeDriver: true }), Animated.spring(bump, { toValue: 1, friction: 3, useNativeDriver: true })]).start();
    onLike();
  };
  const tapBody = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      clearTimeout(single.current);
      lastTap.current = 0;
      popHeart();
      if (!liked) onLike?.();
      return;
    }
    lastTap.current = now;
    if (onPress) single.current = setTimeout(onPress, DOUBLE_TAP_MS);
  };
  const share = () => Share.share({ message: `${item.authorName}: ${item.text}\n\nCityJoy` }).catch(() => {});

  const action = (icon: IconName, label: string, onAct: (() => void) | undefined, color: string, count?: number) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={!onAct} onPress={onAct} hitSlop={6} style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}>
      <MaterialIcons name={icon} size={24} color={color} />
      {count !== undefined ? <AppText style={[styles.count, { color: c.textStrong }]}>{count}</AppText> : null}
    </Pressable>
  );
  const followLabel = follow === 'aktif' ? t('explore.profile.following') : follow === 'istek' ? t('explore.profile.requestedShort') : t('explore.profile.follow');

  return (
    <View style={[styles.post, { borderBottomColor: c.border }]}>
      <View style={styles.top}>
        <Pressable
          accessibilityRole={onAuthor ? 'link' : undefined}
          accessibilityLabel={onAuthor ? t('explore.profile.open', { name: item.authorName }) : undefined}
          disabled={!onAuthor}
          onPress={onAuthor}
          style={styles.author}>
          <View style={[styles.ring, { borderColor: c.accent }]}>
            <View style={[styles.avatar, { backgroundColor: c.surfaceStrong }]}>
              <AppText style={[styles.initial, { color: c.accent }]}>{(item.authorName || '?').slice(0, 1).toLocaleUpperCase(lang)}</AppText>
              <AvatarPhoto uid={item.business ? undefined : item.authorUid} size={36} />
            </View>
          </View>
          <View style={styles.who}>
            <View style={styles.nameRow}>
              <AppText style={[styles.name, styles.shrink, { color: c.textStrong }]} numberOfLines={1}>{item.authorName}</AppText>
              {/* İşletme adına paylaşım: ad işletmenin, dokununca işletme sayfası açılır. */}
              {item.business ? (
                <View style={[styles.bizTag, { backgroundColor: c.accentSoft }]}>
                  <MaterialIcons name="storefront" size={11} color={c.accent} />
                  <AppText style={[styles.bizText, { color: c.accent }]}>{t('explore.businessTag')}</AppText>
                </View>
              ) : null}
            </View>
            <AppText style={[styles.meta, { color: c.textMuted }]} numberOfLines={1}>{[district, ago(item.createdAt)].filter(Boolean).join(' · ')}</AppText>
          </View>
        </Pressable>
        {follow !== undefined && onFollow ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${followLabel}: ${item.authorName}`}
            onPress={onFollow}
            hitSlop={6}
            style={({ pressed }) => [
              styles.follow,
              follow === 'aktif' ? { backgroundColor: c.primary, borderColor: c.primary } : { borderColor: c.accent },
              { opacity: pressed ? 0.75 : 1 },
            ]}>
            <AppText style={[styles.followText, { color: follow === 'aktif' ? c.onPrimary : c.accent }]}>{followLabel}</AppText>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={
          onPress
            ? [item.authorName, t(`explore.categories.${item.category}`), photos.length ? t('explore.photos.count', { count: photos.length }) : '', item.text.slice(0, 120)].filter(Boolean).join('. ')
            : undefined
        }
        accessibilityHint={onLike ? t('explore.doubleTapHint') : undefined}
        onPress={tapBody}
        style={styles.body}>
        {photos.length ? (
          <View style={styles.photos}>
            <PostPhotos photos={photos} maxWidth={640} />
          </View>
        ) : null}
        {item.text ? (
          <AppText selectable={full} numberOfLines={full ? undefined : photos.length ? 3 : 8} style={[short ? styles.textBig : styles.text, { color: c.text }]}>{item.text}</AppText>
        ) : null}
        <Animated.View pointerEvents="none" style={[styles.heart, { opacity: heart, transform: [{ scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }]}>
          <MaterialIcons name="favorite" size={76} color={c.danger} />
        </Animated.View>
      </Pressable>

      <View style={styles.actions}>
        <Animated.View style={{ transform: [{ scale: bump }] }}>
          {action(liked ? 'favorite' : 'favorite-border', liked ? t('explore.unlike') : t('explore.like'), onLike ? pressLike : undefined, liked ? c.danger : c.textStrong, item.likeCount)}
        </Animated.View>
        {action('chat-bubble-outline', t('explore.comments.title', { count: item.commentCount }), onPress, c.textStrong, item.commentCount)}
        {action('share', t('explore.share'), share, c.textStrong)}
        <View style={styles.flex} />
        {onSave ? action(saved ? 'bookmark' : 'bookmark-border', saved ? t('explore.unsave') : t('explore.save'), onSave, saved ? c.accent : c.textStrong) : null}
      </View>
      <View style={styles.foot}>
        <AppText style={[styles.tag, { color: c.accent }]}>#{t(`explore.categories.${item.category}`)}</AppText>
        <AppText style={[styles.targets, { color: c.textSoft }]} numberOfLines={1}>
          {item.targets.map((x) => t(`explore.targets.${x}`)).join(' · ')}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  post: { marginHorizontal: -GUTTER, paddingHorizontal: GUTTER, paddingTop: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  ring: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.heading, fontSize: 15 },
  who: { flex: 1 },
  name: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shrink: { flexShrink: 1 },
  bizTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill },
  bizText: { fontFamily: fonts.bodySemi, fontSize: 10, lineHeight: 14 },
  meta: { fontSize: 12, lineHeight: 16 },
  follow: { minHeight: 34, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  followText: { fontFamily: fonts.bodySemi, fontSize: 13 },
  body: { paddingVertical: 10, gap: 10 },
  photos: { marginHorizontal: -GUTTER },
  text: { fontSize: 15, lineHeight: 22 },
  textBig: { fontFamily: fonts.bodyMedium, fontSize: 18, lineHeight: 26 },
  heart: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, minWidth: 44, paddingEnd: 10 },
  count: { fontFamily: fonts.bodySemi, fontSize: 14 },
  flex: { flex: 1 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tag: { fontFamily: fonts.bodySemi, fontSize: 12 },
  targets: { flex: 1, fontSize: 11 },
});
