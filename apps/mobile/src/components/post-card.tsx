import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useRef, type ComponentProps } from 'react';
import { Animated, Pressable, Share, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Post } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
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
 * Keşfet gönderisi, akış görünümünde (Instagram hissi, 13. madde 29): çerçevesiz, ekran genişliğinde; üstte paylaşan
 * ve yeri, ortada yazı, altta beğeni, yorum ve paylaş. Yazıya iki kez dokunmak beğenir (kalp belirir), bir kez dokunmak
 * gönderiyi açar. "Hareketi azalt" açıksa kalp animasyonsuz görünür.
 */
export function PostCard({ item, liked, full, onPress, onLike, onAuthor }: Props) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const { language, rtl } = useSettings();
  const lang = language ?? 'tr';
  const reduce = useReduceMotion();
  const ago = useRelativeTime();
  const district = repo.getDistrict(item.region.districtId)?.name;
  const heart = useRef(new Animated.Value(0)).current;
  const bump = useRef(new Animated.Value(1)).current;
  const lastTap = useRef(0);
  const single = useRef<ReturnType<typeof setTimeout>>(undefined);

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
      <MaterialIcons name={icon} size={23} color={color} />
      {count !== undefined ? <AppText style={[styles.count, { color: c.textStrong }]}>{count}</AppText> : null}
    </Pressable>
  );

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
            </View>
          </View>
          <View style={styles.who}>
            <AppText style={[styles.name, { color: c.textStrong }]} numberOfLines={1}>{item.authorName}</AppText>
            <AppText style={[styles.meta, { color: c.textMuted }]} numberOfLines={1}>{[district, ago(item.createdAt)].filter(Boolean).join(' · ')}</AppText>
          </View>
        </Pressable>
        <View style={[styles.tag, { backgroundColor: c.accentSoft }]}>
          <AppText style={[styles.tagText, { color: c.icon }]}>{t(`explore.categories.${item.category}`)}</AppText>
        </View>
      </View>

      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? `${item.authorName}. ${t(`explore.categories.${item.category}`)}. ${item.text.slice(0, 120)}` : undefined}
        accessibilityHint={onLike ? t('explore.doubleTapHint') : undefined}
        onPress={tapBody}
        style={styles.body}>
        <AppText selectable={full} numberOfLines={full ? undefined : 6} style={[styles.text, { color: c.text }]}>{item.text}</AppText>
        <Animated.View pointerEvents="none" style={[styles.heart, { opacity: heart, transform: [{ scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }]}>
          <MaterialIcons name="favorite" size={72} color={c.danger} />
        </Animated.View>
      </Pressable>

      <View style={styles.actions}>
        <Animated.View style={{ transform: [{ scale: bump }] }}>
          {action(liked ? 'favorite' : 'favorite-border', liked ? t('explore.unlike') : t('explore.like'), onLike ? pressLike : undefined, liked ? c.danger : c.textStrong, item.likeCount)}
        </Animated.View>
        {action('chat-bubble-outline', t('explore.comments.title', { count: item.commentCount }), onPress, c.textStrong, item.commentCount)}
        {action('send', t('explore.share'), share, c.textStrong)}
        <AppText style={[styles.targets, { color: c.textSoft, textAlign: rtl ? 'left' : 'right' }]} numberOfLines={1}>
          {item.targets.map((x) => t(`explore.targets.${x}`)).join(' · ')}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  post: { marginHorizontal: -GUTTER, paddingHorizontal: GUTTER, paddingTop: spacing.sm, paddingBottom: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  ring: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.heading, fontSize: 14 },
  who: { flex: 1 },
  name: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 18 },
  meta: { fontSize: 12, lineHeight: 16 },
  tag: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontFamily: fonts.bodyMedium, fontSize: 11 },
  body: { paddingVertical: 6 },
  text: { fontSize: 15, lineHeight: 21 },
  heart: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44, minWidth: 44, paddingEnd: 8 },
  count: { fontFamily: fonts.bodySemi, fontSize: 13 },
  targets: { flex: 1, fontSize: 11 },
});
