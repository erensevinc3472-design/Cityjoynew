import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';
import { byPopulation, DISTRICT_ZONES, videoEmbedUrl, type DistrictZone, type Municipality, type TravelMunicipal, type TravelRoute } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { BottomShade } from '@/components/city-tiles';
import { FilterChip, ListSurface, SectionTitle } from '@/components/inner';
import { BLEED_STRIP, BLEED_STRIP_CONTENT, PageHead, PAGE_CONTENT, usePageBottom } from '@/components/page-head';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { ThumbImage } from '@/components/thumb-image';
import { VideoModal } from '@/components/video-modal';
import { locationRepository as repo } from '@/lib/locations';
import { cityMunicipalities, ROUTE_THEME_ICONS, useDurationText, useTravelMunicipal, useTravelRoutes } from '@/lib/travel';
import { fonts, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type Filter = 'all' | DistrictZone;
type Item = Municipality & { intro?: TravelMunicipal; routes: TravelRoute[]; population?: number };

const GOLD = '#E2B277';

/**
 * Başkanlarla Keşif (tasarım: bursa-belediye-kesif.html; kurallar PROJE.md 5.2, Eren onayladı): her ilçeyi kendi
 * belediyesi tanıtır. Puan yok; bütün ilçeler aynı boyutta satır; sıralama nüfusa göre; "Belediye tanıtımı" etiketi;
 * seçim döneminde başkan adı ve fotoğrafı gizlenir (`showMayor`). Tanıtımı olmayan ilçe de listede kalır.
 * Görünüm (Eren, 12 Kasım 2026): tepede il fotoğrafı yok; başkanların sinematik portreleri yan yana (önce büyükşehir /
 * il, sonra ilçeler nüfusa göre; hepsi aynı boyutta), ilçe satırlarında da başkanın fotoğrafı. Başkan adı, fotoğrafı
 * ve vekillik panelden (Seyahat > Başkanlarla Keşif) girilir; uygulamada sabit kişi yok.
 */
export default function TravelMayorsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const bottom = usePageBottom();
  const duration = useDurationText();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { value: intros, failed, retry } = useTravelMunicipal(code);
  const { value: routes } = useTravelRoutes(code);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [playing, setPlaying] = useState<{ src: string; title: string } | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const listY = useRef(0);
  const rowY = useRef<Record<string, number>>({});
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
  const rows = [...(province && filter === 'all' ? [province] : []), ...shown];
  const year = districts.find((d) => d.intro?.populationYear)?.intro?.populationYear;

  const hasIntro = (m: Item) => !!m.intro?.description;
  const showMayor = (m: Item) => !!m.intro && m.intro.showMayor && !!m.intro.mayorName;
  const mayors = [...(province ? [province] : []), ...districts].filter(showMayor);

  const play = (url: string, title: string) => {
    const embed = videoEmbedUrl(url);
    if (embed) setPlaying({ src: embed, title });
    else WebBrowser.openBrowserAsync(url).catch(() => {});
  };
  const placeOf = (m: Item) =>
    m.scope.level === 'ilce' ? repo.getDistrict(m.scope.districtId)?.name ?? m.name : m.kind === 'buyuksehir-belediyesi' ? t('travel.metropolitan', { name }) : name;
  const mayorLine = (m: Item) =>
    showMayor(m) ? (m.intro!.mayorActing ? t('travel.actingMayorOf', { name: m.intro!.mayorName }) : t('travel.mayorOf', { name: m.intro!.mayorName })) : undefined;

  /** Portreye dokununca o belediyenin satırı açılır ve ekrana gelir. */
  const focus = (m: Item) => {
    if (m.kind === 'ilce-belediyesi' && filter !== 'all' && m.intro?.zone !== filter) setFilter('all');
    if (hasIntro(m)) setOpen(m.id);
    requestAnimationFrame(() => {
      const y = rowY.current[m.id];
      if (y != null) scroll.current?.scrollTo({ y: Math.max(0, listY.current + y - 24), animated: true });
    });
  };

  /** Sinematik portre: koyu, sıcak tonlu, altın kenarlı; altta il/ilçe, ad ve görev. */
  const portrait = (m: Item) => {
    const intro = m.intro!;
    const role = intro.mayorActing ? t('travel.actingMayor') : t('travel.mayorLabel');
    const place = placeOf(m);
    return (
      <Pressable
        key={m.id}
        accessibilityRole="button"
        accessibilityLabel={`${intro.mayorName}. ${place} ${role}`}
        onPress={() => focus(m)}
        style={({ pressed }) => [styles.portrait, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
        {intro.mayorPhoto ? (
          <ThumbImage photo={intro.mayorPhoto} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" transition={200} accessibilityIgnoresInvertColors />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.silhouette]}>
            <MaterialIcons name="person" size={92} color="rgba(226, 178, 119, 0.28)" />
          </View>
        )}
        {/* Sinema tonu: üstte hafif, altta koyu petrol; sıcak altın parıltı. */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tint]} />
        <BottomShade color="#04171A" top={0.25} bottom={0.96} />
        <View pointerEvents="none" style={styles.glow} />
        <View style={styles.portraitFoot}>
          <AppText style={styles.portraitPlace} numberOfLines={1}>{place.toLocaleUpperCase(i18n.language)}</AppText>
          <AppText style={styles.portraitName} numberOfLines={2}>{intro.mayorName}</AppText>
          <View style={styles.portraitRule} />
          <AppText style={styles.portraitRole} numberOfLines={1}>{role}</AppText>
        </View>
      </Pressable>
    );
  };

  /** Açılan tanıtım: kapak, yazı, belediyenin rotaları, video. */
  const details = (m: Item, place: string) => {
    const intro = m.intro!;
    return (
      <View style={styles.body}>
        {intro.cover ? <ThumbImage photo={intro.cover} style={[styles.cover, { aspectRatio: Math.min(2, Math.max(1, intro.cover.width / intro.cover.height)), backgroundColor: c.surfaceStrong }]} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
        <AppText style={[styles.text, { color: c.text }]}>{intro.description}</AppText>
        {m.routes.length ? <AppText style={[styles.h3, { color: c.textStrong }]}>{t('travel.municipalRoutes')}</AppText> : null}
        {m.routes.map((r) => (
          <Pressable
            key={r.id}
            accessibilityRole="button"
            accessibilityLabel={`${r.title}. ${r.stops.map((s) => s.name).join(', ')}. ${duration(r.durationMinutes)}`}
            onPress={() => router.push({ pathname: '/travel/route/[id]', params: { id: r.id } })}
            style={({ pressed }) => [styles.route, { backgroundColor: c.background, borderColor: c.border, opacity: pressed ? 0.85 : 1 }]}>
            <View style={[styles.routeIcon, { backgroundColor: c.accentSoft }]}>
              <MaterialIcons name={ROUTE_THEME_ICONS[r.theme]} size={16} color={c.accent} />
            </View>
            <View style={styles.flex}>
              <AppText style={[styles.routeTitle, { color: c.textStrong }]} numberOfLines={1}>{r.title}</AppText>
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
    );
  };

  /** Belediye satırı: hepsi aynı boyutta (Eren onayladı: büyük-küçük ilçe ayrımı yok). Solda başkanın fotoğrafı. */
  const row = (m: Item, first: boolean) => {
    const intro = m.intro;
    const ready = hasIntro(m);
    const expanded = open === m.id && ready;
    const place = placeOf(m);
    const isProvince = m.kind !== 'ilce-belediyesi';
    const sub = mayorLine(m) ?? m.name;
    const photo = showMayor(m) ? intro?.mayorPhoto : undefined;
    return (
      <View
        key={m.id}
        onLayout={(e) => (rowY.current[m.id] = e.nativeEvent.layout.y)}
        style={!first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={ready ? { expanded } : { disabled: true }}
          disabled={!ready}
          accessibilityLabel={[place, sub, ready ? intro!.slogan : t('travel.introPreparing'), isProvince ? t('travel.provinceIntro') : t('travel.municipalTag')].filter(Boolean).join('. ')}
          onPress={() => setOpen(expanded ? null : m.id)}
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.75 : 1 }]}>
          {photo ? (
            <ThumbImage photo={photo} style={[styles.thumb, { backgroundColor: c.surfaceStrong, borderColor: isProvince ? GOLD : c.border }]} contentFit="cover" contentPosition="top" accessibilityIgnoresInvertColors />
          ) : (
            <View style={[styles.thumb, styles.monogram, { backgroundColor: ready ? c.accentSoft : c.surfaceStrong, borderColor: isProvince ? GOLD : 'transparent' }]}>
              {isProvince ? (
                <MaterialIcons name="location-city" size={22} color={c.accent} />
              ) : (
                <AppText style={[styles.monogramText, { color: ready ? c.accent : c.textSoft }]}>{place.slice(0, 1).toLocaleUpperCase(i18n.language)}</AppText>
              )}
            </View>
          )}
          <View style={styles.flex}>
            <View style={styles.titleRow}>
              <AppText style={[styles.place, { color: c.textStrong }]} numberOfLines={1}>{place}</AppText>
              {isProvince ? (
                <View style={[styles.zone, { borderColor: c.accentBorder }]}>
                  <AppText style={[styles.zoneText, { color: c.accent }]}>{t('travel.provinceIntro')}</AppText>
                </View>
              ) : intro?.zone ? (
                <View style={[styles.zone, { borderColor: c.border }]}>
                  <AppText style={[styles.zoneText, { color: c.textMuted }]}>{t(`travel.zones.${intro.zone}`)}</AppText>
                </View>
              ) : null}
            </View>
            <AppText style={[styles.sub, { color: c.textMuted }]} numberOfLines={1}>{sub}</AppText>
            <AppText style={[styles.slogan, { color: ready ? c.text : c.textSoft }, !ready && styles.italic]} numberOfLines={expanded ? undefined : 1}>
              {ready ? intro!.slogan : t('travel.introPreparing')}
            </AppText>
          </View>
          {ready ? (
            <View style={styles.trail}>
              {m.routes.length ? (
                <View style={[styles.count, { backgroundColor: c.accentSoft }]}>
                  <MaterialIcons name="route" size={12} color={c.accent} />
                  <AppText style={[styles.countText, { color: c.accent }]}>{m.routes.length}</AppText>
                </View>
              ) : null}
              {intro!.videoUrl ? <MaterialIcons name="play-circle-outline" size={18} color={c.accent} /> : null}
              <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={22} color={c.textSoft} />
            </View>
          ) : null}
        </Pressable>
        {expanded ? details(m, place) : null}
      </View>
    );
  };

  return (
    <Screen bleed>
      <ScrollView ref={scroll} contentContainerStyle={[PAGE_CONTENT, styles.content, { paddingBottom: bottom }]} showsVerticalScrollIndicator={false}>
        <PageHead title={t('travel.mayorsTitle')} subtitle={name} onBack={back} />
        <AppText style={[styles.intro, { color: c.textMuted }]}>{t('travel.mayorsIntro', { count: districts.length })}</AppText>

        {failed && !intros ? <StateMessage kind="error" onRetry={retry} /> : intros === null ? <StateMessage kind="loading" /> : null}

        {mayors.length ? (
          <>
            <SectionTitle title={t('travel.mayorsStrip')} aside={String(mayors.length)} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={BLEED_STRIP} contentContainerStyle={[BLEED_STRIP_CONTENT, styles.strip]}>
              {mayors.map(portrait)}
            </ScrollView>
          </>
        ) : null}

        <SectionTitle title={t('travel.districtList')} aside={t('city.hub.districts', { count: districts.length })} />
        {zones.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={BLEED_STRIP} contentContainerStyle={[BLEED_STRIP_CONTENT, styles.filters]}>
            {(['all', ...zones] as Filter[]).map((f) => (
              <FilterChip key={f} small label={f === 'all' ? t('travel.all') : t(`travel.zones.${f}`)} active={f === filter} onPress={() => setFilter(f)} />
            ))}
          </ScrollView>
        ) : null}
        {rows.length ? (
          <View onLayout={(e) => (listY.current = e.nativeEvent.layout.y)}>
            <ListSurface>{rows.map((m, i) => row(m, i === 0))}</ListSurface>
          </View>
        ) : null}

        <View style={styles.noteRow}>
          <MaterialIcons name="info-outline" size={13} color={c.textSoft} />
          <AppText style={[styles.note, { color: c.textSoft }]}>{year ? t('travel.orderNoteYear', { year }) : t('travel.orderNote')}</AppText>
        </View>
      </ScrollView>
      <VideoModal src={playing?.src ?? null} title={playing?.title ?? ''} onClose={() => setPlaying(null)} />
    </Screen>
  );
}

const white = '#FFFFFF';
const styles = StyleSheet.create({
  content: { gap: spacing.md },
  intro: { fontSize: 13, lineHeight: 19 },
  flex: { flex: 1 },
  filters: { gap: spacing.xs + 2 },
  strip: { gap: spacing.sm + 2, paddingBottom: 4 },
  portrait: { width: 138, height: 196, borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: '#0A2226', borderWidth: 1, borderColor: 'rgba(226, 178, 119, 0.45)' },
  silhouette: { alignItems: 'center', justifyContent: 'center', paddingBottom: 40, backgroundColor: '#0D2A2F' },
  tint: { backgroundColor: 'rgba(120, 72, 20, 0.12)' },
  glow: { position: 'absolute', start: 0, end: 0, top: 0, height: 2, backgroundColor: 'rgba(226, 178, 119, 0.7)' },
  portraitFoot: { padding: spacing.sm + 2, gap: 2 },
  portraitPlace: { color: GOLD, fontFamily: fonts.bodySemi, fontSize: 9, letterSpacing: 1.4 },
  portraitName: { color: white, fontFamily: fonts.display, fontSize: 16, lineHeight: 20 },
  portraitRule: { width: 22, height: 2, borderRadius: 1, backgroundColor: GOLD, marginVertical: 3 },
  portraitRole: { color: 'rgba(255,255,255,0.75)', fontSize: 10.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 72, paddingVertical: spacing.sm + 2 },
  thumb: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', borderWidth: 1.5 },
  monogram: { alignItems: 'center', justifyContent: 'center' },
  monogramText: { fontFamily: fonts.display, fontSize: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  place: { fontFamily: fonts.heading, fontSize: 15.5, lineHeight: 20, flexShrink: 1 },
  zone: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill, borderWidth: 1 },
  zoneText: { fontSize: 9.5, fontFamily: fonts.bodySemi },
  sub: { fontSize: 12, lineHeight: 16 },
  slogan: { fontFamily: fonts.bodyMedium, fontSize: 12.5, lineHeight: 17, marginTop: 1 },
  italic: { fontStyle: 'italic' },
  trail: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill },
  countText: { fontFamily: fonts.bodySemi, fontSize: 11 },
  body: { paddingBottom: spacing.md, paddingHorizontal: 2, gap: spacing.sm },
  cover: { width: '100%', borderRadius: radius.md },
  text: { fontSize: 14, lineHeight: 21 },
  h3: { fontFamily: fonts.headingSemi, fontSize: 14, lineHeight: 19, marginTop: spacing.xs },
  route: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm + 2, borderRadius: radius.md, borderWidth: 1, minHeight: MIN_TOUCH },
  routeIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  routeTitle: { fontFamily: fonts.bodySemi, fontSize: 13 },
  video: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: GOLD, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, minHeight: MIN_TOUCH },
  videoText: { color: '#081F24', fontFamily: fonts.heading, fontSize: 12 },
  noteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  note: { fontSize: 11, lineHeight: 15, textAlign: 'center' },
});
