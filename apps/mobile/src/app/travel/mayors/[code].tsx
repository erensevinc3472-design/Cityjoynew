import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { byPopulation, DISTRICT_ZONES, videoEmbedUrl, type DistrictZone, type Municipality, type TravelMunicipal, type TravelRoute } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { SceneArt, sceneSky } from '@/components/scene-art';
import { StateMessage } from '@/components/state-message';
import { TravelHeader } from '@/components/travel-header';
import { VideoModal } from '@/components/video-modal';
import { locationRepository as repo } from '@/lib/locations';
import { cityMunicipalities, ROUTE_THEME_ICONS, useDurationText, useTravelMunicipal, useTravelRoutes } from '@/lib/travel';
import { fonts, GUTTER, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type Filter = 'all' | DistrictZone;
type Item = Municipality & { intro?: TravelMunicipal; routes: TravelRoute[]; population?: number };

/**
 * Başkanlarla Keşif (tasarım: bursa-belediye-kesif.html; kurallar PROJE.md 5.2, Eren onayladı): her ilçeyi kendi
 * belediyesi tanıtır. Puan yok; bütün ilçeler aynı boyutta kart; sıralama nüfusa göre; "Belediye tanıtımı" etiketi;
 * seçim döneminde başkan adı gizlenir. İl tanıtımı (büyükşehir / il belediyesi) en üstte. Tanıtımı olmayan ilçe de
 * listede kalır ("Tanıtım hazırlanıyor"), küçük ilçeler kaybolmaz.
 */
export default function TravelMayorsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const duration = useDurationText();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { value: intros, failed, retry } = useTravelMunicipal(code);
  const { value: routes } = useTravelRoutes(code);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [playing, setPlaying] = useState<{ src: string; title: string } | null>(null);
  const name = repo.getProvince(code)?.name ?? '';
  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/travel/city/[code]', params: { code } }));

  const all: Item[] = cityMunicipalities(code).map((m) => {
    const intro = intros?.find((x) => x.id === m.id);
    return { ...m, intro, population: intro?.population, routes: (routes ?? []).filter((r) => r.municipalityId === m.id) };
  });
  const province = all.find((m) => m.kind !== 'ilce-belediyesi');
  const districts = all.filter((m) => m.kind === 'ilce-belediyesi').sort(byPopulation);
  const zones = DISTRICT_ZONES.filter((z) => districts.some((d) => d.intro?.zone === z));
  const shown = districts.filter((d) => filter === 'all' || d.intro?.zone === filter);
  const year = districts.find((d) => d.intro?.populationYear)?.intro?.populationYear;

  const play = (url: string, title: string) => {
    const embed = videoEmbedUrl(url);
    if (embed) setPlaying({ src: embed, title });
    else WebBrowser.openBrowserAsync(url).catch(() => {});
  };

  const card = (m: Item, isProvince = false) => {
    const intro = m.intro;
    const expanded = open === m.id;
    const place = isProvince ? name : m.scope.level === 'ilce' ? repo.getDistrict(m.scope.districtId)?.name ?? m.name : m.name;
    const mayor = intro?.showMayor && intro.mayorName ? intro.mayorName : undefined;
    return (
      <View key={m.id} style={[styles.card, { backgroundColor: c.surface, borderColor: expanded ? c.accentBorder : c.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={intro ? { expanded } : { disabled: true }}
          disabled={!intro}
          accessibilityLabel={[place, m.name, mayor, intro?.slogan ?? t('travel.introPreparing'), t('travel.municipalTag')].filter(Boolean).join('. ')}
          onPress={() => setOpen(expanded ? null : m.id)}
          style={styles.head}>
          <View style={[styles.icon, { backgroundColor: c.accentSoft }]}>
            <MaterialIcons name={isProvince ? 'location-city' : 'account-balance'} size={20} color={c.accent} />
          </View>
          <View style={styles.flex}>
            <View style={styles.row}>
              <AppText style={[styles.kicker, { color: c.accent }]}>
                {(isProvince ? t('travel.provinceIntro') : t('travel.municipalTag')).toLocaleUpperCase(i18n.language)}
              </AppText>
              {intro?.zone ? (
                <View style={[styles.zone, { borderColor: c.border }]}>
                  <AppText style={[styles.zoneText, { color: c.textMuted }]}>{t(`travel.zones.${intro.zone}`)}</AppText>
                </View>
              ) : null}
            </View>
            <AppText style={[styles.place, { color: c.textStrong }]}>{place}</AppText>
            <AppText style={[styles.sub, { color: c.textMuted }]} numberOfLines={1}>
              {mayor ? `${m.name} · ${t('travel.mayorOf', { name: mayor })}` : m.name}
            </AppText>
            <AppText style={[styles.slogan, { color: intro ? c.text : c.textSoft }]} numberOfLines={expanded ? undefined : 1}>
              {intro?.slogan ?? t('travel.introPreparing')}
            </AppText>
          </View>
          {intro ? <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={24} color={c.textSoft} /> : null}
        </Pressable>
        {expanded && intro ? (
          <View style={styles.body}>
            <AppText style={[styles.text, { color: c.text }]}>{intro.description}</AppText>
            {m.routes.length ? <AppText style={[styles.h3, { color: c.textStrong }]}>{t('travel.municipalRoutes')}</AppText> : null}
            {m.routes.map((r) => (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                accessibilityLabel={`${r.title}. ${r.stops.map((s) => s.name).join(', ')}. ${duration(r.durationMinutes)}`}
                onPress={() => router.push({ pathname: '/travel/route/[id]', params: { id: r.id } })}
                style={({ pressed }) => [styles.route, { backgroundColor: c.background, borderColor: c.border, opacity: pressed ? 0.85 : 1 }]}>
                <MaterialIcons name={ROUTE_THEME_ICONS[r.theme]} size={18} color={c.accent} />
                <View style={styles.flex}>
                  <AppText style={[styles.routeTitle, { color: c.textStrong }]}>{r.title}</AppText>
                  <AppText style={[styles.sub, { color: c.textMuted }]} numberOfLines={1}>{r.stops.map((s) => s.name).join(' → ')}</AppText>
                </View>
                <AppText style={[styles.sub, { color: c.textSoft }]}>{duration(r.durationMinutes)}</AppText>
              </Pressable>
            ))}
            {intro.videoUrl ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => play(intro.videoUrl!, `${place} · ${t('travel.video')}`)}
                style={({ pressed }) => [styles.video, { opacity: pressed ? 0.85 : 1 }]}>
                <MaterialIcons name="play-circle-filled" size={20} color="#081F24" />
                <AppText style={styles.videoText}>{t('travel.video')}</AppText>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar style="light" />
      <TravelHeader subtitle={name} title={t('travel.mayors')} onBack={back} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { backgroundColor: sceneSky('townhall') }]}>
          <View style={StyleSheet.absoluteFill}>
            <SceneArt kind="townhall" />
          </View>
          <View style={[StyleSheet.absoluteFill, styles.shade]} />
          <View style={styles.heroText}>
            <AppText style={styles.heroKicker}>{t('travel.mayorsKicker').toLocaleUpperCase(i18n.language)}</AppText>
            <AppText accessibilityRole="header" style={styles.heroTitle}>{t('travel.mayorsTitle')}</AppText>
            <AppText style={styles.heroSub}>{t('travel.mayorsIntro', { count: districts.length })}</AppText>
          </View>
        </View>

        {zones.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityRole="tablist">
            {(['all', ...zones] as Filter[]).map((f) => {
              const selected = f === filter;
              return (
                <Pressable
                  key={f}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setFilter(f)}
                  style={[styles.filter, selected ? { backgroundColor: c.primary, borderColor: c.primary } : { borderColor: c.border, backgroundColor: c.surface }]}>
                  <AppText style={[styles.filterText, { color: selected ? c.onPrimary : c.text }]}>{f === 'all' ? t('travel.all') : t(`travel.zones.${f}`)}</AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={styles.pad}>
          {failed && !intros ? <StateMessage kind="error" onRetry={retry} /> : intros === null ? <StateMessage kind="loading" /> : null}
          {province && filter === 'all' ? card(province, true) : null}
          {shown.map((d) => card(d))}
          <AppText style={[styles.note, { color: c.textSoft }]}>
            {year ? t('travel.orderNoteYear', { year }) : t('travel.orderNote')}
          </AppText>
        </View>
      </ScrollView>
      <VideoModal src={playing?.src ?? null} title={playing?.title ?? ''} onClose={() => setPlaying(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  scroll: { paddingBottom: spacing.xl },
  hero: { height: 220, justifyContent: 'flex-end', overflow: 'hidden' },
  shade: { backgroundColor: 'rgba(8,31,36,0.5)' },
  heroText: { padding: GUTTER + 4, gap: 4 },
  heroKicker: { color: '#E0B07A', fontFamily: fonts.bodySemi, fontSize: 10, letterSpacing: 1.6 },
  heroTitle: { color: '#FFFFFF', fontFamily: fonts.display, fontSize: 26, lineHeight: 32 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18 },
  filters: { paddingHorizontal: GUTTER, paddingTop: spacing.md, gap: spacing.sm },
  filter: { minHeight: 34, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  filterText: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 0.5 },
  pad: { paddingHorizontal: GUTTER, paddingTop: spacing.md, gap: spacing.sm + 2, width: '100%', maxWidth: 640, alignSelf: 'center' },
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, minHeight: 96 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontFamily: fonts.bodySemi, fontSize: 9, letterSpacing: 1 },
  zone: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill, borderWidth: 1 },
  zoneText: { fontSize: 9, fontFamily: fonts.bodySemi },
  place: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 22 },
  sub: { fontSize: 12, lineHeight: 16 },
  slogan: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, marginTop: 2 },
  body: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  text: { fontSize: 14, lineHeight: 21 },
  h3: { fontFamily: fonts.headingSemi, fontSize: 14, lineHeight: 19, marginTop: spacing.xs },
  route: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm + 2, borderRadius: radius.md, borderWidth: 1, minHeight: MIN_TOUCH },
  routeTitle: { fontFamily: fonts.bodySemi, fontSize: 13 },
  video: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E0B07A', paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, minHeight: MIN_TOUCH },
  videoText: { color: '#081F24', fontFamily: fonts.heading, fontSize: 12 },
  note: { fontSize: 11, lineHeight: 15, textAlign: 'center' },
});
