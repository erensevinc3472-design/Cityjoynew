import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Announcement } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { useAuthorLabel } from '@/lib/announcements';
import { useSettings } from '@/lib/settings';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/** Duyuru kartı: acil duyuru kırmızı çerçeveli ve etiketli; yayınlayan, tarih ve metnin başı. */
export function AnnouncementCard({ item, onPress }: { item: Announcement; onPress(): void }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const { language } = useSettings();
  const author = useAuthorLabel(item);
  const urgent = item.kind === 'acil';
  const news = item.kind === 'haber';
  // Etiket: acil, sabit ya da kurum haberi (kategorisiyle).
  const tag = urgent ? t('announcements.urgent') : item.pinned ? t('announcements.pinned') : news ? (item.category ? t(`news.categories.${item.category}`) : t('news.one')) : '';
  const date = item.publishedAt ? new Date(item.publishedAt).toLocaleDateString(language ?? 'tr') : '';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tag ? `${tag}. ` : ''}${item.title}. ${author}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: urgent ? c.dangerSoft : c.surface, borderColor: urgent ? c.danger : c.border, shadowColor: c.shadow, opacity: pressed ? 0.85 : 1 },
      ]}>
      <View style={styles.top}>
        <MaterialIcons name={urgent ? 'warning-amber' : item.pinned ? 'push-pin' : news ? 'newspaper' : 'campaign'} size={20} color={urgent ? c.danger : c.icon} />
        <AppText variant="caption" style={{ color: urgent ? c.danger : c.textMuted, flex: 1 }} numberOfLines={1}>
          {tag ? `${tag} · ` : ''}
          {author}
        </AppText>
        <AppText variant="caption" muted>{date}</AppText>
      </View>
      <AppText style={[styles.title, { color: c.textStrong }]}>{item.title}</AppText>
      <AppText muted numberOfLines={2}>{item.body}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { fontFamily: fonts.heading, fontSize: 16, lineHeight: 22 },
});

/** Ana sayfanın üstündeki ince acil şeridi: yalnızca acil duyuru varsa görünür; dokununca duyuru açılır. */
export function UrgentStrip({ item, onPress }: { item: Announcement; onPress(): void }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const author = useAuthorLabel(item);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('announcements.urgent')}. ${item.title}. ${author}`}
      onPress={onPress}
      style={({ pressed }) => [stripStyles.strip, { backgroundColor: c.dangerSoft, borderColor: c.danger, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[stripStyles.icon, { backgroundColor: c.dangerSoft }]}>
        <MaterialIcons name="warning-amber" size={20} color={c.danger} />
      </View>
      <View style={stripStyles.text}>
        <AppText numberOfLines={1} style={[stripStyles.label, { color: c.danger }]}>{`${t('announcements.urgent')} · ${author}`}</AppText>
        <AppText numberOfLines={2} style={{ color: c.textStrong }}>{item.title}</AppText>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={c.danger} />
    </Pressable>
  );
}

const stripStyles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: 12, borderRadius: radius.md, borderWidth: 1 },
  icon: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  label: { fontFamily: fonts.bodySemi, fontSize: 13 },
});
