import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Post } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { MIN_TOUCH, fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

interface Props {
  item: Post;
  liked: boolean;
  /** Akışta yazının başı; ayrıntıda tamamı. */
  full?: boolean;
  onPress?(): void;
  onLike?(): void;
}

/** Keşfet gönderisi: paylaşan ("Ayşe K."), ilçe, zaman, kategori, yazı, beğeni. */
export function PostCard({ item, liked, full, onPress, onLike }: Props) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const at = new Date(item.createdAt);
  const when = item.createdAt ? `${at.toLocaleDateString(lang, { day: 'numeric', month: 'short' })} ${at.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}` : '';
  const district = repo.getDistrict(item.region.districtId)?.name;

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${item.authorName}. ${t(`explore.categories.${item.category}`)}. ${item.text.slice(0, 120)}` : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: c.surface, borderColor: c.border, shadowColor: c.shadow, opacity: pressed ? 0.9 : 1 }]}>
      <View style={styles.top}>
        <View style={[styles.avatar, { backgroundColor: c.accentSoft }]}>
          <AppText style={[styles.initial, { color: c.icon }]}>{(item.authorName || '?').slice(0, 1).toLocaleUpperCase(lang)}</AppText>
        </View>
        <View style={styles.who}>
          <AppText style={[styles.name, { color: c.textStrong }]} numberOfLines={1}>{item.authorName}</AppText>
          <AppText variant="caption" muted numberOfLines={1}>{[district, when].filter(Boolean).join(' · ')}</AppText>
        </View>
        <View style={[styles.tag, { backgroundColor: c.accentSoft }]}>
          <AppText variant="caption" style={{ color: c.icon }}>{t(`explore.categories.${item.category}`)}</AppText>
        </View>
      </View>
      <AppText selectable={full} numberOfLines={full ? undefined : 6} style={{ color: c.text }}>{item.text}</AppText>
      <View style={styles.bottom}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={liked ? t('explore.unlike') : t('explore.like')}
          accessibilityState={{ selected: liked }}
          disabled={!onLike}
          onPress={onLike}
          hitSlop={8}
          style={({ pressed }) => [styles.like, { opacity: pressed ? 0.7 : 1 }]}>
          <MaterialIcons name={liked ? 'favorite' : 'favorite-border'} size={22} color={liked ? c.danger : c.icon} />
          <AppText variant="caption" muted>{item.likeCount}</AppText>
        </Pressable>
        <View style={styles.like} accessible accessibilityLabel={t('explore.comments.title', { count: item.commentCount })}>
          <MaterialIcons name="chat-bubble-outline" size={20} color={c.icon} />
          <AppText variant="caption" muted>{item.commentCount}</AppText>
        </View>
        <AppText variant="caption" muted numberOfLines={1} style={styles.targets}>
          {item.targets.map((x) => t(`explore.targets.${x}`)).join(' · ')}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.heading, fontSize: 17 },
  who: { flex: 1 },
  name: { fontFamily: fonts.heading, fontSize: 15, lineHeight: 20 },
  tag: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  like: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: MIN_TOUCH, minWidth: MIN_TOUCH },
  targets: { flex: 1 },
});
