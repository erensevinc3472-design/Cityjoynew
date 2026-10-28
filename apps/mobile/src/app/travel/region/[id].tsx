import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TR_REGIONS, TRAVEL_CATEGORIES, videoEmbedUrl, type TravelCategory } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { SceneArt, sceneSky } from '@/components/scene-art';
import { StateMessage } from '@/components/state-message';
import { TravelHeader } from '@/components/travel-header';
import { VideoModal } from '@/components/video-modal';
import { locationRepository as repo } from '@/lib/locations';
import { CATEGORY_SCENES, REGION_SCENES, useTravelCities, useTravelRegions } from '@/lib/travel';
import { fonts, GUTTER, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type Filter = 'all' | TravelCategory;

/**
 * Bölge sayfası (tasarım: marmara.html): kapak, kısa tanıtım, tanıtım videosu (uygulama içinde), il sayısı; kategoriye
 * göre süzülen şehir kartları. Tanıtımı olmayan iller altta "yakında" olarak listelenir. Puan ve "Premium" ibaresi yok
 * (Karar, Eren).
 */
export default function TravelRegionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const def = TR_REGIONS.find((r) => r.id === id);
  const { value: regions } = useTravelRegions();
  const { value: cities, failed, retry } = useTravelCities(id);
  const [filter, setFilter] = useState<Filter>('all');
  const [playing, setPlaying] = useState<string | null>(null);
  const content = regions?.find((r) => r.id === id);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/travel/explore'));

  if (!def) {
    return (
      <View style={[styles.root, { backgroundColor: c.background }]}>
        <TravelHeader subtitle={t('travel.route')} onBack={back} />
        <StateMessage kind="empty" message={t('travel.notFound')} />
      </View>
    );
  }

  const name = t(`travel.regions.${def.id}`);
  const scene = REGION_SCENES[def.id];
  const live = (cities ?? []).filter((x) => def.provinceCodes.includes(x.id));
  const shown = live
    .filter((x) => filter === 'all' || x.categories.includes(filter))
    .sort((a, b) => def.provinceCodes.indexOf(a.id) - def.provinceCodes.indexOf(b.id));
  const soon = def.provinceCodes.filter((p) => !live.some((x) => x.id === p));
  const used = TRAVEL_CATEGORIES.filter((k) => live.some((x) => x.categories.includes(k)));
  const play = (url: string) => {
    const embed = videoEmbedUrl(url);
    if (embed) setPlaying(embed);
    else WebBrowser.openBrowserAsync(url).catch(() => {});
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar style="light" />
      <TravelHeader subtitle={`${name} / ${t('travel.cityPick')}`} onBack={back} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Kapak */}
        <View style={[styles.hero, { height: Math.round(width * 0.95), backgroundColor: sceneSky(scene) }]}>
          <View style={StyleSheet.absoluteFill}>
            <SceneArt kind={scene} />
          </View>
          <View style={[StyleSheet.absoluteFill, styles.heroShade]} />
          <View style={styles.heroText}>
            {content?.tagline ? (
              <View style={styles.badge}>
                <AppText style={styles.badgeText}>{content.tagline.toLocaleUpperCase()}</AppText>
              </View>
            ) : null}
            <AppText accessibilityRole="header" style={styles.heroTitle}>{name}</AppText>
            {content?.description ? <AppText style={styles.heroDesc}>{content.description}</AppText> : null}
            <View style={styles.heroRow}>
              {content?.videoUrl ? (
                <Pressable accessibilityRole="button" onPress={() => play(content.videoUrl!)} style={({ pressed }) => [styles.video, { opacity: pressed ? 0.85 : 1 }]}>
                  <MaterialIcons name="play-circle-filled" size={22} color="#081F24" />
                  <AppText style={styles.videoText}>{t('travel.video')}</AppText>
                </Pressable>
              ) : null}
              <View style={styles.chip}>
                <MaterialIcons name="location-city" size={13} color="#E0B07A" />
                <AppText style={styles.chipText}>{t('travel.statCities', { count: def.provinceCodes.length })}</AppText>
              </View>
            </View>
          </View>
        </View>

        {/* Süzgeç */}
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
          <AppText accessibilityRole="header" style={[styles.h2, { color: c.textStrong }]}>{t('travel.citiesTitle')}</AppText>
          <AppText variant="caption" muted>{t('travel.citiesIntro', { region: name })}</AppText>

          {failed && !cities ? <StateMessage kind="error" onRetry={retry} /> : cities === null ? <StateMessage kind="loading" /> : null}
          {shown.map((x) => {
            const cityName = repo.getProvince(x.id)?.name ?? x.id;
            const sc = CATEGORY_SCENES[x.categories[0] ?? 'tarih'];
            return (
              <Pressable
                key={x.id}
                accessibilityRole="button"
                accessibilityLabel={`${cityName}. ${x.tagline}`}
                onPress={() => router.push({ pathname: '/travel/city/[code]', params: { code: x.id } })}
                style={({ pressed }) => [styles.card, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.9 : 1 }]}>
                <View style={[styles.cardArt, { backgroundColor: sceneSky(sc) }]}>
                  <SceneArt kind={sc} />
                  <View style={styles.cats}>
                    {x.categories.slice(0, 2).map((k) => (
                      <View key={k} style={styles.catTag}>
                        <AppText style={styles.catText}>{t(`travel.cats.${k}`).toLocaleUpperCase()}</AppText>
                      </View>
                    ))}
                  </View>
                </View>
                <View style={styles.cardBody}>
                  <AppText style={[styles.cardTitle, { color: c.textStrong }]}>{cityName}</AppText>
                  {x.tagline ? <AppText style={[styles.cardTag, { color: c.accent }]}>{x.tagline.toLocaleUpperCase()}</AppText> : null}
                  <AppText numberOfLines={2} style={[styles.cardDesc, { color: c.textMuted }]}>{x.description}</AppText>
                  <View style={styles.highlights}>
                    {x.highlights.slice(0, 3).map((h) => (
                      <View key={h} style={[styles.hl, { backgroundColor: c.surfaceStrong }]}>
                        <AppText style={[styles.hlText, { color: c.text }]}>{h}</AppText>
                      </View>
                    ))}
                    <View style={[styles.arrow, { borderColor: c.accentBorder, backgroundColor: c.accentSoft }]}>
                      <MaterialIcons name="arrow-forward" size={16} color={c.accent} />
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
          {cities && !live.length ? <StateMessage kind="empty" message={t('travel.noCities')} /> : null}

          {soon.length ? (
            <View style={styles.soonBox}>
              <AppText variant="label">{t('travel.soonCities')}</AppText>
              <AppText variant="caption" muted>{soon.map((p) => repo.getProvince(p)?.name).filter(Boolean).join(' · ')}</AppText>
            </View>
          ) : null}
        </View>
      </ScrollView>
      <VideoModal src={playing} title={`${name} · ${t('travel.video')}`} onClose={() => setPlaying(null)} />
    </View>
  );
}

const white = '#FFFFFF';
const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: spacing.xl },
  hero: { maxHeight: 460, justifyContent: 'flex-end', overflow: 'hidden' },
  heroShade: { backgroundColor: 'rgba(8,31,36,0.45)' },
  heroText: { padding: GUTTER + 4, gap: spacing.sm },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(224,176,122,0.45)', backgroundColor: 'rgba(224,176,122,0.18)' },
  badgeText: { color: '#E0B07A', fontFamily: fonts.bodySemi, fontSize: 9, letterSpacing: 1.5 },
  heroTitle: { color: white, fontFamily: fonts.display, fontSize: 32, lineHeight: 38 },
  heroDesc: { color: '#C7D8DA', fontSize: 14, lineHeight: 21 },
  heroRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  video: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E0B07A', paddingVertical: 9, paddingHorizontal: 16, borderRadius: radius.pill, minHeight: 44 },
  videoText: { color: '#081F24', fontFamily: fonts.heading, fontSize: 12, letterSpacing: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: 'rgba(23,70,75,0.7)' },
  chipText: { color: white, fontFamily: fonts.bodySemi, fontSize: 12 },
  filters: { paddingHorizontal: GUTTER, paddingVertical: spacing.md, gap: spacing.sm },
  filter: { minHeight: 34, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  filterText: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 0.5 },
  pad: { paddingHorizontal: GUTTER, gap: spacing.md, width: '100%', maxWidth: 640, alignSelf: 'center' },
  h2: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26 },
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  cardArt: { height: 150, overflow: 'hidden' },
  cats: { position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', gap: 4 },
  catTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  catText: { color: white, fontSize: 8, fontFamily: fonts.bodySemi, letterSpacing: 1 },
  cardBody: { padding: spacing.md, gap: 4 },
  cardTitle: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 23 },
  cardTag: { fontFamily: fonts.bodySemi, fontSize: 10, letterSpacing: 1 },
  cardDesc: { fontSize: 13, lineHeight: 19 },
  highlights: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 4 },
  hl: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  hlText: { fontSize: 11 },
  arrow: { marginLeft: 'auto', width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  soonBox: { gap: 4, paddingTop: spacing.sm },
});
