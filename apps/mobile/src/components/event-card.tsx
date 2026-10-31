import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CityEvent } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/** Etkinlik kartı: solda gün ve ay, ortada ad, saat, yer, ücret; kapak görseli varsa sağda küçük; iptal edilmişse etiket. */
export function EventCard({ item, onPress }: { item: CityEvent; onPress(): void }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const start = new Date(item.startsAt);
  const cancelled = item.status === 'iptal';
  const district = item.region.districtId ? repo.getDistrict(item.region.districtId)?.name : undefined;
  const time = start.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${cancelled ? `${t('events.cancelled')}. ` : ''}${item.title}, ${start.toLocaleDateString(lang, { dateStyle: 'full' })} ${time}, ${item.venueName}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: c.surface, borderColor: c.border, shadowColor: c.shadow, opacity: cancelled ? 0.7 : pressed ? 0.85 : 1 }]}>
      <View style={[styles.date, { backgroundColor: c.accentSoft }]}>
        <AppText style={[styles.day, { color: c.textStrong }]}>{start.getDate()}</AppText>
        <AppText variant="caption" style={{ color: c.icon }}>{start.toLocaleDateString(lang, { month: 'short' })}</AppText>
      </View>
      <View style={styles.body}>
        {cancelled ? <AppText variant="caption" style={{ color: c.danger }}>{t('events.cancelled')}</AppText> : null}
        <AppText style={[styles.title, { color: c.textStrong }]} numberOfLines={2}>{item.title}</AppText>
        <AppText variant="caption" muted numberOfLines={1}>
          {start.toLocaleDateString(lang, { weekday: 'short' })} {time} · {[item.venueName, district].filter(Boolean).join(', ')}
        </AppText>
        <AppText variant="caption" muted>
          {t(`events.categories.${item.category}`)} · {item.free ? t('events.free') : item.priceNote}
        </AppText>
      </View>
      {item.cover ? <Image source={{ uri: item.cover.url }} style={[styles.cover, { backgroundColor: c.surfaceStrong }]} contentFit="cover" recyclingKey={item.cover.path} accessibilityIgnoresInvertColors /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: spacing.md, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 10 },
  date: { width: 56, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xs },
  day: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 24 },
  body: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.heading, fontSize: 16, lineHeight: 22 },
  cover: { width: 64, height: 64, borderRadius: radius.sm, alignSelf: 'center' },
});
