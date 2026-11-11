import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { placeImage, ROUTE_LENGTHS, type Photo, type RouteLength, type TravelRoute } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { BottomShade } from '@/components/city-tiles';
import { FilterChip } from '@/components/inner';
import { BLEED_STRIP, BLEED_STRIP_CONTENT, PageHead, PAGE_CONTENT, usePageBottom } from '@/components/page-head';
import { CoverArt, sceneSky } from '@/components/scene-art';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { ROUTE_THEME_ICONS, ROUTE_THEME_SCENES, useDurationText, useTravelCity, useTravelPlaces, useTravelRoutes } from '@/lib/travel';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type Filter = 'all' | RouteLength;

const GOLD = '#E2B277';

/**
 * Hazır Rotalar (tasarım: bursa-hazir-rotalar.html): temalı rotalar, süre filtresi (2-3 saat, yarım gün, 1 gün). Kartta
 * tema, durak ve süre, ilk duraklar. Puan ve "keşfeden" sayısı yok (Karar, Eren). Belediyenin rotası "Belediye tanıtımı".
 * Görünüm (12 Kasım 2026): il fotoğrafı tepede; kart resmi rotanın kapağı, yoksa duraklardan birinin fotoğrafı
 * (gezilecek yerlerden), o da yoksa il kapağı; en son çizim.
 */
export default function TravelRoutesScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { rtl } = useSettings();
  const bottom = usePageBottom();
  const duration = useDurationText();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { value: city } = useTravelCity(code);
  const { value: routes, failed, retry } = useTravelRoutes(code);
  const { value: places } = useTravelPlaces(code);
  const [filter, setFilter] = useState<Filter>('all');
  const name = repo.getProvince(code)?.name ?? '';
  const cover = city?.cover ?? undefined;
  const own = (routes ?? []).filter((r) => !r.municipalityId);
  const lengths = ROUTE_LENGTHS.filter((l) => own.some((r) => r.length === l));
  const shown = own.filter((r) => filter === 'all' || r.length === filter);
  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/travel/city/[code]', params: { code } }));

  /** Kart resmi: kapak, yoksa fotoğrafı olan ilk durak. */
  const imageOf = (r: TravelRoute): Photo | undefined => {
    if (r.cover) return r.cover;
    for (const s of r.stops) {
      const p = s.placeId ? places?.find((x) => x.id === s.placeId) : undefined;
      const img = p ? placeImage(p) : undefined;
      if (img) return img;
    }
    return undefined;
  };

  return (
    <Screen bleed cover={cover}>
      <ScrollView contentContainerStyle={[PAGE_CONTENT, styles.content, { paddingBottom: bottom }]} showsVerticalScrollIndicator={false}>
        <PageHead cover={cover} extend={6} title={t('travel.routesTitle')} subtitle={name} onBack={back} />
        <AppText style={[styles.intro, { color: c.textMuted }]}>{t('travel.routesIntro')}</AppText>

        {lengths.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={BLEED_STRIP} contentContainerStyle={[BLEED_STRIP_CONTENT, styles.filters]}>
            {(['all', ...lengths] as Filter[]).map((f) => (
              <FilterChip
                key={f}
                label={f === 'all' ? `${t('travel.all')} · ${own.length}` : t(`travel.lengths.${f}`)}
                icon={f === 'all' ? undefined : 'schedule'}
                active={f === filter}
                onPress={() => setFilter(f)}
              />
            ))}
          </ScrollView>
        ) : null}

        {failed && !routes ? <StateMessage kind="error" onRetry={retry} /> : routes === null ? <StateMessage kind="loading" /> : null}
        {routes && !own.length ? <StateMessage kind="empty" message={t('travel.noRoutes')} /> : null}
        {routes && own.length > 0 && !shown.length ? <StateMessage kind="empty" message={t('travel.noRoutesLength')} /> : null}

        {shown.map((r) => {
          const scene = ROUTE_THEME_SCENES[r.theme];
          const photo = imageOf(r) ?? cover;
          const first = r.stops.slice(0, 3);
          const more = r.stops.length - first.length;
          const meta = `${t('travel.stops', { count: r.stops.length })} · ${duration(r.durationMinutes)}`;
          return (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              accessibilityLabel={`${r.title}. ${t(`travel.routeThemes.${r.theme}`)}. ${t(`travel.lengths.${r.length}`)}. ${meta}. ${r.summary}`}
              onPress={() => router.push({ pathname: '/travel/route/[id]', params: { id: r.id } })}
              style={({ pressed }) => [styles.card, { backgroundColor: c.surface, borderColor: c.border, transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
              <View style={[styles.art, { backgroundColor: sceneSky(scene) }]}>
                <CoverArt photo={photo} kind={scene} still />
                <BottomShade top={0.35} bottom={0.9} />
                <View style={styles.artTop}>
                  <View style={styles.theme}>
                    <MaterialIcons name={ROUTE_THEME_ICONS[r.theme]} size={13} color="#081F24" />
                    <AppText style={styles.themeText}>{t(`travel.routeThemes.${r.theme}`).toLocaleUpperCase(i18n.language)}</AppText>
                  </View>
                  <View style={styles.length}>
                    <MaterialIcons name="schedule" size={12} color="#FFFFFF" />
                    <AppText style={styles.lengthText}>{t(`travel.lengths.${r.length}`)}</AppText>
                  </View>
                </View>
                <View>
                  <AppText style={styles.title} numberOfLines={2}>{r.title}</AppText>
                  <AppText style={styles.meta}>{meta}</AppText>
                </View>
              </View>
              <View style={styles.body}>
                <AppText style={[styles.summary, { color: c.textMuted }]} numberOfLines={2}>{r.summary}</AppText>
                {/* İlk duraklar: noktalı ince yol. */}
                <View style={styles.stops}>
                  {first.map((s, i) => (
                    <View key={`${s.name}-${i}`} style={styles.stop}>
                      <View style={styles.rail}>
                        <View style={[styles.dot, { borderColor: c.accent, backgroundColor: i === 0 ? c.accent : 'transparent' }]} />
                        {i < first.length - 1 || more > 0 ? <View style={[styles.line, { backgroundColor: c.border }]} /> : null}
                      </View>
                      <AppText style={[styles.stopName, { color: c.textStrong }]} numberOfLines={1}>{s.name}</AppText>
                    </View>
                  ))}
                  {more > 0 ? (
                    <View style={styles.stop}>
                      <View style={styles.rail}>
                        <View style={[styles.dot, styles.dotMore, { borderColor: c.textSoft }]} />
                      </View>
                      <AppText style={[styles.moreText, { color: c.textSoft }]}>{t('travel.moreStops', { count: more })}</AppText>
                    </View>
                  ) : null}
                </View>
                <View style={[styles.foot, { borderTopColor: c.border }]}>
                  <AppText style={[styles.detail, { color: c.accent }]}>{t('travel.details')}</AppText>
                  <MaterialIcons name={rtl ? 'arrow-back' : 'arrow-forward'} size={16} color={c.accent} />
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const white = '#FFFFFF';
const styles = StyleSheet.create({
  content: { gap: spacing.md },
  intro: { fontSize: 13, lineHeight: 19 },
  filters: { gap: spacing.xs + 2 },
  card: { borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  art: { height: 164, justifyContent: 'space-between', padding: spacing.md, overflow: 'hidden' },
  artTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  theme: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: GOLD, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, flexShrink: 1 },
  themeText: { color: '#081F24', fontFamily: fonts.bodySemi, fontSize: 9.5, letterSpacing: 1 },
  length: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: 'rgba(6,20,23,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  lengthText: { color: white, fontFamily: fonts.bodySemi, fontSize: 10.5 },
  title: { color: white, fontFamily: fonts.display, fontSize: 22, lineHeight: 27 },
  meta: { color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 16, marginTop: 2 },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.sm + 2, gap: spacing.sm },
  summary: { fontSize: 13, lineHeight: 18 },
  stops: { gap: 0 },
  stop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 24 },
  rail: { width: 12, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, borderWidth: 2 },
  dotMore: { width: 7, height: 7, borderWidth: 1.5 },
  line: { position: 'absolute', top: '50%', bottom: '-50%', width: 1.5, marginTop: 5 },
  stopName: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13 },
  moreText: { fontSize: 12 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.sm + 2, marginTop: 2 },
  detail: { fontFamily: fonts.bodySemi, fontSize: 13 },
});
