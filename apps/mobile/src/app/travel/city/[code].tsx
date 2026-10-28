import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { regionOfProvince, TRAVEL_CATEGORIES, videoEmbedUrl, type TravelCategory } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { SceneArt, sceneSky } from '@/components/scene-art';
import { StateMessage } from '@/components/state-message';
import { TravelHeader } from '@/components/travel-header';
import { VideoModal } from '@/components/video-modal';
import { locationRepository as repo } from '@/lib/locations';
import { CATEGORY_SCENES, useTravelCities, useTravelPlaces } from '@/lib/travel';
import { fonts, GUTTER, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];
type Filter = 'all' | TravelCategory;

/**
 * Şehir sayfası (tasarım: bursa.html): kapak, kısa tanıtım, kaynaklı bilgiler (UNESCO, rakım...), Kareler / Başkanlarla
 * Keşif / Yöresel kutuları ve Hazır Rotalar (sonraki aşamalar, şimdilik "yakında"), kategoriye göre gezilecek yerler.
 * Puan, nüfus gibi kaynaksız sayılar yok; yapay zekâ rehberi bilgi tabanı dolunca gelecek.
 */
export default function TravelCityScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const { code } = useLocalSearchParams<{ code: string }>();
  const region = regionOfProvince(code);
  const { value: cities } = useTravelCities(region?.id);
  const { value: places, failed, retry } = useTravelPlaces(code);
  const [filter, setFilter] = useState<Filter>('all');
  const [playing, setPlaying] = useState<string | null>(null);
  const city = cities?.find((x) => x.id === code);
  const name = repo.getProvince(code)?.name ?? '';
  const regionName = region ? t(`travel.regions.${region.id}`) : '';
  const back = () => (router.canGoBack() ? router.back() : router.replace(region ? { pathname: '/travel/region/[id]', params: { id: region.id } } : '/travel/explore'));

  if (cities && !city) {
    return (
      <View style={[styles.root, { backgroundColor: c.background }]}>
        <TravelHeader subtitle={regionName} title={name} onBack={back} />
        <StateMessage kind="empty" message={t('travel.cityPreparing', { name })} />
      </View>
    );
  }

  const scene = CATEGORY_SCENES[city?.categories[0] ?? 'tarih'];
  const used = TRAVEL_CATEGORIES.filter((k) => (places ?? []).some((p) => p.category === k));
  const shown = (places ?? []).filter((p) => filter === 'all' || p.category === filter);
  const play = (url: string) => {
    const embed = videoEmbedUrl(url);
    if (embed) setPlaying(embed);
    else WebBrowser.openBrowserAsync(url).catch(() => {});
  };
  const boxes: { icon: IconName; title: string; hint: string }[] = [
    { icon: 'photo-library', title: t('travel.frames', { name }), hint: t('travel.framesHint') },
    { icon: 'explore', title: t('travel.mayors'), hint: t('travel.mayorsHint') },
    { icon: 'diversity-3', title: t('travel.local', { name }), hint: t('travel.localHint') },
  ];

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar style="light" />
      <TravelHeader subtitle={regionName} title={name} onBack={back} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { height: Math.round(width * 0.8), backgroundColor: sceneSky(scene) }]}>
          <View style={StyleSheet.absoluteFill}>
            <SceneArt kind={scene} />
          </View>
          <View style={[StyleSheet.absoluteFill, styles.heroShade]} />
          <View style={styles.heroText}>
            {city?.tagline ? (
              <View style={styles.badge}>
                <AppText style={styles.badgeText}>{city.tagline.toLocaleUpperCase(i18n.language)}</AppText>
              </View>
            ) : null}
            <AppText accessibilityRole="header" style={styles.heroTitle}>{name}</AppText>
            {city?.videoUrl ? (
              <Pressable accessibilityRole="button" onPress={() => play(city.videoUrl!)} style={({ pressed }) => [styles.video, { opacity: pressed ? 0.85 : 1 }]}>
                <MaterialIcons name="play-circle-filled" size={22} color="#081F24" />
                <AppText style={styles.videoText}>{t('travel.video')}</AppText>
              </Pressable>
            ) : null}
          </View>
        </View>

        {city ? (
          <View style={styles.pad}>
            <AppText style={[styles.desc, { color: c.text }]}>{city.description}</AppText>
            {city.facts.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.facts}>
                {city.facts.map((f) => (
                  <View key={f.label} style={[styles.fact, { backgroundColor: c.surface, borderColor: c.border }]}>
                    <AppText style={[styles.factLabel, { color: c.textMuted }]}>{f.label}</AppText>
                    <AppText style={[styles.factValue, { color: c.textStrong }]}>{f.value}</AppText>
                    {f.source ? <AppText style={[styles.factSource, { color: c.textSoft }]}>{[f.source, f.asOf].filter(Boolean).join(', ')}</AppText> : null}
                  </View>
                ))}
              </ScrollView>
            ) : null}

            {/* Kareler, Başkanlarla Keşif, Yöresel: sonraki aşamalar. */}
            <View style={styles.boxes}>
              {boxes.map((b) => (
                <View key={b.title} accessible accessibilityLabel={`${b.title}. ${t('travel.soon')}`} style={[styles.box, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <View style={styles.boxTop}>
                    <View style={[styles.boxIcon, { backgroundColor: c.accentSoft }]}>
                      <MaterialIcons name={b.icon} size={16} color={c.accent} />
                    </View>
                    <AppText style={[styles.soon, { color: c.accent }]}>{t('travel.soon').toLocaleUpperCase(i18n.language)}</AppText>
                  </View>
                  <AppText style={[styles.boxTitle, { color: c.textStrong }]} numberOfLines={2}>{b.title}</AppText>
                  <AppText style={[styles.boxHint, { color: c.textMuted }]} numberOfLines={2}>{b.hint}</AppText>
                </View>
              ))}
            </View>

            <View accessible accessibilityLabel={`${t('travel.routes')}. ${t('travel.soon')}`} style={styles.routes}>
              <View style={styles.routesIcon}>
                <MaterialIcons name="route" size={24} color="#081F24" />
              </View>
              <View style={styles.flex}>
                <AppText style={styles.routesTitle}>{t('travel.routes')}</AppText>
                <AppText style={styles.routesHint}>{t('travel.routesHint')}</AppText>
              </View>
              <View style={styles.routesSoon}>
                <AppText style={styles.routesSoonText}>{t('travel.soon')}</AppText>
              </View>
            </View>
          </View>
        ) : null}

        {used.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityRole="tablist">
            {(['all', ...used] as Filter[]).map((f) => {
              const selected = f === filter;
              return (
                <Pressable
                  key={f}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setFilter(f)}
                  style={[styles.filter, selected ? { backgroundColor: c.primary, borderColor: c.primary } : { borderColor: c.border, backgroundColor: c.surface }]}>
                  <AppText style={[styles.filterText, { color: selected ? c.onPrimary : c.text }]}>{f === 'all' ? t('travel.all') : t(`travel.cats.${f}`)}</AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={styles.pad}>
          <View>
            <AppText accessibilityRole="header" style={[styles.h2, { color: c.textStrong }]}>{t('travel.places')}</AppText>
            {places ? <AppText variant="caption" muted>{t('travel.placesCount', { count: places.length })}</AppText> : null}
          </View>
          {failed && !places ? <StateMessage kind="error" onRetry={retry} /> : places === null ? <StateMessage kind="loading" /> : null}
          {places && !places.length ? <StateMessage kind="empty" message={t('travel.noPlaces')} /> : null}
          {shown.map((p) => {
            const sc = CATEGORY_SCENES[p.category];
            const district = p.districtId ? repo.getDistrict(p.districtId)?.name : undefined;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={`${p.name}. ${p.kind}. ${p.summary}`}
                onPress={() => router.push({ pathname: '/travel/place/[id]', params: { id: p.id } })}
                style={({ pressed }) => [styles.place, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.9 : 1 }]}>
                <View style={[styles.placeArt, { backgroundColor: sceneSky(sc) }]}>
                  <SceneArt kind={sc} />
                </View>
                <View style={styles.placeBody}>
                  <View style={styles.placeTop}>
                    <AppText style={[styles.kind, { color: c.accent }]} numberOfLines={1}>{p.kind.toLocaleUpperCase(i18n.language)}</AppText>
                    {p.mustSee ? (
                      <View style={[styles.must, { backgroundColor: c.accentSoft }]}>
                        <MaterialIcons name="star" size={10} color={c.accent} />
                        <AppText style={[styles.mustText, { color: c.accent }]}>{t('travel.mustSee')}</AppText>
                      </View>
                    ) : null}
                  </View>
                  <AppText style={[styles.placeName, { color: c.textStrong }]} numberOfLines={1}>{p.name}</AppText>
                  <AppText style={[styles.placeSummary, { color: c.textMuted }]} numberOfLines={2}>{p.summary}</AppText>
                  {district ? (
                    <View style={styles.placeMeta}>
                      <MaterialIcons name="place" size={12} color={c.textSoft} />
                      <AppText style={[styles.metaText, { color: c.textSoft }]}>{district}</AppText>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <VideoModal src={playing} title={`${name} · ${t('travel.video')}`} onClose={() => setPlaying(null)} />
    </View>
  );
}

const white = '#FFFFFF';
const navy = '#081F24';
const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingBottom: spacing.xl },
  hero: { maxHeight: 380, justifyContent: 'flex-end', overflow: 'hidden' },
  heroShade: { backgroundColor: 'rgba(8,31,36,0.4)' },
  heroText: { padding: GUTTER + 4, gap: spacing.sm },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(224,176,122,0.45)', backgroundColor: 'rgba(47,93,58,0.75)' },
  badgeText: { color: '#E0B07A', fontFamily: fonts.bodySemi, fontSize: 9, letterSpacing: 1.5 },
  heroTitle: { color: white, fontFamily: fonts.display, fontSize: 32, lineHeight: 38 },
  video: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E0B07A', paddingVertical: 9, paddingHorizontal: 16, borderRadius: radius.pill, minHeight: 44 },
  videoText: { color: navy, fontFamily: fonts.heading, fontSize: 12, letterSpacing: 1 },
  pad: { paddingHorizontal: GUTTER, paddingTop: spacing.md, gap: spacing.md, width: '100%', maxWidth: 640, alignSelf: 'center' },
  desc: { fontSize: 14, lineHeight: 21 },
  facts: { gap: spacing.sm },
  fact: { width: 170, padding: 10, borderRadius: radius.md, borderWidth: 1, gap: 2 },
  factLabel: { fontSize: 11, lineHeight: 14 },
  factValue: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 18 },
  factSource: { fontSize: 10, lineHeight: 13 },
  boxes: { flexDirection: 'row', gap: spacing.sm },
  box: { flex: 1, padding: 10, borderRadius: radius.md, borderWidth: 1, gap: 4 },
  boxTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  boxIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  soon: { fontFamily: fonts.bodySemi, fontSize: 8, letterSpacing: 1 },
  boxTitle: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 16 },
  boxHint: { fontSize: 10, lineHeight: 13 },
  routes: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: '#E0B07A', minHeight: MIN_TOUCH + 20 },
  routesIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  routesTitle: { color: navy, fontFamily: fonts.heading, fontSize: 15, lineHeight: 20 },
  routesHint: { color: 'rgba(8,31,36,0.75)', fontSize: 12, lineHeight: 16 },
  routesSoon: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: 'rgba(8,31,36,0.15)' },
  routesSoonText: { color: navy, fontFamily: fonts.bodySemi, fontSize: 10 },
  filters: { paddingHorizontal: GUTTER, paddingTop: spacing.lg, gap: spacing.sm },
  filter: { minHeight: 34, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  filterText: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 0.5 },
  h2: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26 },
  place: { flexDirection: 'row', borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden', minHeight: 104 },
  placeArt: { width: 96, overflow: 'hidden' },
  placeBody: { flex: 1, padding: spacing.sm + 2, gap: 2 },
  placeTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kind: { flexShrink: 1, fontFamily: fonts.bodySemi, fontSize: 9, letterSpacing: 1 },
  must: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill },
  mustText: { fontFamily: fonts.bodySemi, fontSize: 9 },
  placeName: { fontFamily: fonts.heading, fontSize: 15, lineHeight: 20 },
  placeSummary: { fontSize: 12, lineHeight: 17 },
  placeMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  metaText: { fontSize: 11 },
});
