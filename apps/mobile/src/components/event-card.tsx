import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CityEvent } from '@cityjoy/shared';

import { ThumbImage } from '@/components/thumb-image';
import { AppText } from '@/components/app-text';
import { frost } from '@/components/city-hub';
import { FrostFill } from '@/components/glass';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useResolvedScheme, useThemeColors } from '@/theme/use-theme';

/** "21 Kas", "26–28 Kas", "30 Kas – 2 Ara" (birden çok gün süren etkinlik). */
export function eventDateRange(item: Pick<CityEvent, 'startsAt' | 'endsAt'>, lang: string) {
  const s = new Date(item.startsAt);
  const e = new Date(item.endsAt);
  const month = (d: Date) => d.toLocaleDateString(lang, { month: 'short' });
  if (s.toDateString() === e.toDateString() || e < s) return `${s.getDate()} ${month(s)}`;
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) return `${s.getDate()}–${e.getDate()} ${month(s)}`;
  return `${s.getDate()} ${month(s)} – ${e.getDate()} ${month(e)}`;
}

/**
 * Etkinlik kartı (Eren'in tasarım örneği `etkinlikler.png`, 10 Kasım 2026): solda kapak görseli (yoksa gün ve ay),
 * üstünde "Ücretsiz"; sağda tür ve ilçe, ad, kısa açıklama, tarih ve saat, "Detay". İptal edilmişse etiket. Örnekteki
 * kaydet düğmesi yeni özellik olduğundan yok.
 */
export function EventCard({ item, showProvince, onPress }: { item: CityEvent; /** Başka ilin etkinliği (Türkiye geneli liste): il adı da yazar. */ showProvince?: boolean; onPress(): void }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const dark = useResolvedScheme() === 'dark';
  const { language, rtl } = useSettings();
  const lang = language ?? 'tr';
  const start = new Date(item.startsAt);
  const cancelled = item.status === 'iptal';
  const districtName = item.region.districtId ? repo.getDistrict(item.region.districtId)?.name : undefined;
  const district = showProvince ? [districtName, repo.getProvince(item.region.provinceCode)?.name].filter(Boolean).join(', ') : districtName;
  const time = start.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
  const gold = dark ? c.heroAccent : c.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${cancelled ? `${t('events.cancelled')}. ` : ''}${item.title}, ${start.toLocaleDateString(lang, { dateStyle: 'full' })} ${time}, ${item.venueName}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, frost(dark, c.surface, c.border), { opacity: cancelled ? 0.7 : pressed ? 0.85 : 1 }]}>
      <FrostFill />
      <View style={[styles.media, { backgroundColor: dark ? 'rgba(226, 178, 119, 0.10)' : c.accentSoft }]}>
        {item.cover ? (
          <ThumbImage photo={item.cover} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
        ) : (
          <>
            <AppText style={[styles.day, { color: c.textStrong }]}>{start.getDate()}</AppText>
            <AppText style={[styles.month, { color: gold }]}>{start.toLocaleDateString(lang, { month: 'short' })}</AppText>
          </>
        )}
        {item.free && !cancelled ? (
          <View style={[styles.free, { backgroundColor: c.success }]}>
            <AppText style={styles.freeText}>{t('events.free')}</AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        {cancelled ? <AppText style={[styles.meta, { color: c.danger }]}>{t('events.cancelled')}</AppText> : null}
        <View style={styles.metaRow}>
          <AppText style={[styles.meta, styles.kind, { color: gold }]} numberOfLines={1}>{t(`events.categories.${item.category}`)}</AppText>
          {district ? (
            <>
              <MaterialIcons name="place" size={12} color={c.textMuted} />
              <AppText style={[styles.meta, styles.shrink, { color: c.textMuted }]} numberOfLines={1}>{district}</AppText>
            </>
          ) : null}
        </View>
        <AppText style={[styles.title, { color: c.textStrong }]} numberOfLines={2}>{item.title}</AppText>
        <AppText style={[styles.desc, { color: c.textMuted }]} numberOfLines={1}>{item.description}</AppText>
        <View style={styles.foot}>
          <MaterialIcons name="event" size={14} color={gold} />
          <AppText style={[styles.footText, { color: c.text }]} numberOfLines={1}>{eventDateRange(item, lang)}</AppText>
          <MaterialIcons name="schedule" size={14} color={gold} />
          <AppText style={[styles.footText, styles.shrink, { color: c.text }]} numberOfLines={1}>{time}</AppText>
          <View style={[styles.detail, { borderColor: dark ? 'rgba(226, 178, 119, 0.6)' : c.primary }]}>
            <AppText style={[styles.detailText, { color: gold }]}>{t('events.detail')}</AppText>
            <MaterialIcons name={rtl ? 'arrow-back' : 'arrow-forward'} size={13} color={gold} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.lg + 2, overflow: 'hidden', minHeight: 112 },
  media: { width: 104, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  day: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 30 },
  month: { fontFamily: fonts.bodySemi, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  free: { position: 'absolute', top: 8, start: 8, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  freeText: { fontFamily: fonts.bodySemi, fontSize: 10.5, color: '#FFFFFF' },
  body: { flex: 1, gap: 3, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.sm + 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  meta: { fontSize: 11.5, lineHeight: 15 },
  kind: { fontFamily: fonts.bodySemi, marginEnd: 6, flexShrink: 1 },
  shrink: { flexShrink: 1 },
  title: { fontFamily: fonts.heading, fontSize: 15, lineHeight: 20 },
  desc: { fontSize: 12, lineHeight: 16 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  footText: { fontFamily: fonts.bodySemi, fontSize: 11.5, marginEnd: 6 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 3, marginStart: 'auto', borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 9, minHeight: 26 },
  detailText: { fontFamily: fonts.bodySemi, fontSize: 11.5 },
});
