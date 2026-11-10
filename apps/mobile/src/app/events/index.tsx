import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { EVENT_CATEGORIES, type CityEvent, type EventCategory } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { PillButton } from '@/components/city-hub';
import { useProvinceCover } from '@/components/city-cover';
import { EventCard, eventDateRange } from '@/components/event-card';
import { FilterChip } from '@/components/inner';
import { BLEED_STRIP, BLEED_STRIP_CONTENT, PageHead, PAGE_CONTENT, usePageBottom } from '@/components/page-head';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { ThumbImage } from '@/components/thumb-image';
import { NATIONWIDE, useEvents } from '@/lib/events';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useResolvedScheme, useThemeColors } from '@/theme/use-theme';

/** Tepedeki kayan öne çıkanlar: kapak görseli olan ilk etkinlikler. */
const MAX_FEATURED = 5;
const DAYS = 7;

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
/** Etkinlik o gün sürüyor mu (çok günlük festival dahil). */
const onDay = (e: CityEvent, day: Date) => {
  const s = dayStart(day).getTime();
  return new Date(e.startsAt).getTime() < s + 86_400_000 && new Date(e.endsAt).getTime() >= s;
};

/**
 * Etkinlikler (Eren'in tasarım örneği `etkinlikler.png`, 10 Kasım 2026): kayan ince başlık ve il fotoğrafı; kapaklı
 * etkinlikler varsa tepede kayan büyük görseller; il geneli / yalnızca ilçe seçimi; önümüzdeki yedi günün şeridi (bir
 * güne dokununca o günün etkinlikleri); tür düğmeleri; kartlar. Örnekteki kaydet, bildirim, Bölgesel/Genel ve alt
 * menü yeni özellik olduğundan yok.
 */
export default function EventsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const dark = useResolvedScheme() === 'dark';
  const cover = useProvinceCover();
  const bottom = usePageBottom();
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const { location } = useUserLocation();
  const [onlyDistrict, setOnlyDistrict] = useState(true);
  // Bölgesel: ilin listesi; Genel: Türkiye geneli liste (yalnızca seçilince okunur).
  const local = useEvents(location?.provinceCode);
  const national = useEvents(location && !onlyDistrict ? NATIONWIDE : undefined);
  const { list, failed, reload } = onlyDistrict ? local : national;
  const [day, setDay] = useState<number | null>(null);
  const [category, setCategory] = useState<EventCategory | null>(null);
  const [width, setWidth] = useState(0);
  const [slide, setSlide] = useState(0);
  const district = location?.districtId ? repo.getDistrict(location.districtId) : undefined;
  const province = location ? repo.getProvince(location.provinceCode)?.name : undefined;
  const gold = dark ? c.heroAccent : c.primary;
  const open = (e: CityEvent) => router.push({ pathname: '/events/[id]', params: { id: e.id } });

  const days = useMemo(() => {
    const today = dayStart(new Date());
    return Array.from({ length: DAYS }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));
  }, []);

  // İl geneli etkinlikler ilçe süzgecinde de görünür.
  const regional = list && onlyDistrict && district ? list.filter((e) => !e.region.districtId || e.region.districtId === district.id) : list;
  const dated = regional && day !== null ? regional.filter((e) => onDay(e, days[day]!)) : regional;
  const categories = useMemo(() => EVENT_CATEGORIES.filter((k) => (dated ?? []).some((e) => e.category === k)), [dated]);
  const shown = dated && category ? dated.filter((e) => e.category === category) : dated;
  const featured = (regional ?? []).filter((e) => e.cover && e.status !== 'iptal').slice(0, MAX_FEATURED);

  const head = (
    <PageHead cover={cover} extend={featured.length ? 24 : 60} title={t('events.title')} subtitle={province} onBack={() => (router.canGoBack() ? router.back() : router.replace('/social'))} />
  );

  if (!location) {
    return (
      <Screen bleed cover={cover}>
        <ScrollView contentContainerStyle={[PAGE_CONTENT, styles.content, { paddingBottom: bottom }]}>
          {head}
          <StateMessage kind="empty" message={t('events.needLocation')} />
          <PillButton gold icon="edit-location-alt" label={t('home.changeLocation')} onPress={() => router.push('/location?edit=1')} />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen bleed cover={cover}>
      <ScrollView
        contentContainerStyle={[PAGE_CONTENT, styles.content, { paddingBottom: bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}>
        {head}

        {featured.length ? (
          <View onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))} style={styles.featured}>
            {width ? (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => setSlide(Math.round(e.nativeEvent.contentOffset.x / width))}
                scrollEventThrottle={32}>
                {featured.map((e) => (
                  <Pressable key={e.id} accessibilityRole="button" accessibilityLabel={e.title} onPress={() => open(e)} style={{ width }}>
                    <ThumbImage photo={e.cover!} style={styles.featuredImage} contentFit="cover" accessibilityIgnoresInvertColors />
                    <View style={styles.featuredShade} />
                    <View style={styles.featuredText}>
                      <AppText style={styles.featuredTitle} numberOfLines={2}>{e.title}</AppText>
                      <AppText style={styles.featuredMeta} numberOfLines={1}>{`${eventDateRange(e, lang)} · ${e.venueName}`}</AppText>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            {featured.length > 1 ? (
              <View style={styles.dots} pointerEvents="none">
                {featured.map((e, i) => (
                  <View key={e.id} style={[styles.dot, i === slide ? { width: 16, backgroundColor: c.heroAccent } : { backgroundColor: 'rgba(255, 255, 255, 0.55)' }]} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {location ? (
          <View style={[styles.segment, { borderColor: dark ? 'rgba(226, 178, 119, 0.3)' : c.border, backgroundColor: dark ? 'rgba(10, 38, 42, 0.42)' : c.surface }]}>
            {[true, false].map((only) => {
              const on = onlyDistrict === only;
              return (
                <Pressable
                  key={String(only)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityHint={only ? t('events.regionalHint', { district: district?.name ?? province ?? '' }) : t('events.generalHint')}
                  onPress={() => setOnlyDistrict(only)}
                  style={[styles.segmentItem, on && { backgroundColor: c.primary }]}>
                  <MaterialIcons name={only ? 'place' : 'public'} size={16} color={on ? c.onPrimary : c.textMuted} />
                  <AppText style={[styles.segmentText, { color: on ? c.onPrimary : c.text }]} numberOfLines={1}>
                    {only ? t('events.regional') : t('events.general')}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.dayHead}>
          <MaterialIcons name="calendar-month" size={18} color={gold} />
          <AppText accessibilityRole="header" style={[styles.dayTitle, { color: c.textStrong }]}>
            {day === null ? t('events.thisWeek') : day === 0 ? t('events.today') : days[day]!.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' })}
          </AppText>
          <AppText style={[styles.monthLabel, { color: c.textMuted }]}>{days[0]!.toLocaleDateString(lang, { month: 'long', year: 'numeric' })}</AppText>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={BLEED_STRIP} contentContainerStyle={[BLEED_STRIP_CONTENT, styles.days]}>
          {days.map((d, i) => {
            const on = day === i;
            const has = (regional ?? []).some((e) => onDay(e, d));
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={d.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' })}
                onPress={() => setDay(on ? null : i)}
                style={({ pressed }) => [
                  styles.dayBox,
                  on ? { backgroundColor: c.primary, borderColor: c.primary } : { backgroundColor: dark ? 'rgba(10, 38, 42, 0.42)' : c.surface, borderColor: dark ? 'rgba(220, 240, 236, 0.14)' : c.border },
                  { opacity: pressed ? 0.8 : 1 },
                ]}>
                <AppText style={[styles.weekday, { color: on ? c.onPrimary : c.textMuted }]}>{d.toLocaleDateString(lang, { weekday: 'short' })}</AppText>
                <AppText style={[styles.dayNum, { color: on ? c.onPrimary : c.textStrong }]}>{d.getDate()}</AppText>
                <View style={[styles.has, { backgroundColor: has ? (on ? c.onPrimary : gold) : 'transparent' }]} />
              </Pressable>
            );
          })}
        </ScrollView>

        {categories.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={BLEED_STRIP} contentContainerStyle={[BLEED_STRIP_CONTENT, styles.chips]}>
            <FilterChip small icon="apps" label={t('city.all')} active={!category} onPress={() => setCategory(null)} />
            {categories.map((k) => (
              <FilterChip small key={k} label={t(`events.categories.${k}`)} active={category === k} onPress={() => setCategory(category === k ? null : k)} />
            ))}
          </ScrollView>
        ) : null}

        {failed && !list?.length ? (
          <StateMessage kind="error" message={t('events.loadError')} onRetry={reload} />
        ) : shown === null ? (
          <StateMessage kind="loading" />
        ) : shown.length === 0 ? (
          <StateMessage kind="empty" message={t('events.empty')} />
        ) : (
          <>
            <AppText style={[styles.found, { color: c.textMuted }]}>{t('events.found', { count: shown.length })}</AppText>
            {shown.map((e) => <EventCard key={e.id} item={e} showProvince={e.region.provinceCode !== location?.provinceCode} onPress={() => open(e)} />)}
          </>
        )}
        <AppText variant="caption" muted>{t('events.note')}</AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm + 4 },
  featured: { borderRadius: radius.xl, overflow: 'hidden', height: 190 },
  featuredImage: { width: '100%', height: 190 },
  featuredShade: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: 'rgba(0, 0, 0, 0.28)' },
  featuredText: { position: 'absolute', start: spacing.md, end: spacing.md, bottom: spacing.lg, gap: 2 },
  featuredTitle: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 23, color: '#FFFFFF', textShadowColor: 'rgba(0, 0, 0, 0.4)', textShadowRadius: 6 },
  featuredMeta: { fontSize: 12, color: 'rgba(255, 255, 255, 0.88)' },
  dots: { position: 'absolute', bottom: 8, alignSelf: 'center', flexDirection: 'row', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.pill, padding: 3 },
  segmentItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 38, borderRadius: radius.pill, paddingHorizontal: spacing.sm },
  segmentText: { fontFamily: fonts.bodySemi, fontSize: 13, flexShrink: 1 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs },
  dayTitle: { flex: 1, fontFamily: fonts.heading, fontSize: 15.5, lineHeight: 20 },
  monthLabel: { fontSize: 12 },
  days: { gap: spacing.sm },
  dayBox: { width: 52, minHeight: 66, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 1 },
  weekday: { fontFamily: fonts.bodySemi, fontSize: 11, textTransform: 'uppercase' },
  dayNum: { fontFamily: fonts.heading, fontSize: 19, lineHeight: 23 },
  has: { width: 5, height: 5, borderRadius: 3 },
  chips: { gap: spacing.xs + 2, paddingVertical: 2 },
  found: { fontFamily: fonts.bodySemi, fontSize: 12.5 },
});
