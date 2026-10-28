import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Activity } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/** Aktivite kartı: solda gün ve ay, sağda ad, saat, mahalle (tam adres yok), kalan yer; iptal etiketi. */
export function ActivityCard({ item, neighbourhood, onPress }: { item: Activity; neighbourhood?: string; onPress(): void }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const start = new Date(item.startsAt);
  const cancelled = item.status === 'iptal';
  const district = repo.getDistrict(item.region.districtId)?.name;
  const time = start.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
  const left = Math.max(0, item.capacity - item.attendeeCount);
  const place = [neighbourhood, district].filter(Boolean).join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${cancelled ? `${t('activities.cancelled')}. ` : ''}${item.title}, ${start.toLocaleDateString(lang, { dateStyle: 'full' })} ${time}, ${place}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: c.surface, borderColor: c.border, shadowColor: c.shadow, opacity: cancelled ? 0.7 : pressed ? 0.85 : 1 }]}>
      <View style={[styles.date, { backgroundColor: c.accentSoft }]}>
        <AppText style={[styles.day, { color: c.textStrong }]}>{start.getDate()}</AppText>
        <AppText variant="caption" style={{ color: c.icon }}>{start.toLocaleDateString(lang, { month: 'short' })}</AppText>
      </View>
      <View style={styles.body}>
        {cancelled ? <AppText variant="caption" style={{ color: c.danger }}>{t('activities.cancelled')}</AppText> : null}
        <AppText style={[styles.title, { color: c.textStrong }]} numberOfLines={2}>{item.title}</AppText>
        <AppText variant="caption" muted numberOfLines={1}>
          {start.toLocaleDateString(lang, { weekday: 'short' })} {time} · {place}
        </AppText>
        <AppText variant="caption" muted>
          {t(`activities.categories.${item.category}`)} · {left ? t('activities.seatsLeft', { count: left }) : t('activities.full')}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: spacing.md, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 10 },
  date: { width: 56, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xs },
  day: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 26 },
  body: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.heading, fontSize: 16, lineHeight: 22 },
});
