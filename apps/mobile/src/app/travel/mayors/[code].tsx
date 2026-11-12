import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { byPopulation, DISTRICT_ZONES, videoEmbedUrl, type DistrictZone, type Municipality, type TravelMunicipal, type TravelRoute } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { BottomShade, TOWNHALL_ART } from '@/components/city-tiles';
import { FilterChip, ListSurface, SectionTitle } from '@/components/inner';
import { BLEED_STRIP, BLEED_STRIP_CONTENT, PageHead, PAGE_CONTENT, usePageBottom } from '@/components/page-head';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { ThumbImage } from '@/components/thumb-image';
import { VideoModal } from '@/components/video-modal';
import { locationRepository as repo } from '@/lib/locations';
import { cityMunicipalities, ROUTE_THEME_ICONS, useDurationText, useTravelCity, useTravelMunicipal, useTravelRoutes } from '@/lib/travel';
import { fonts, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type Filter = 'all' | DistrictZone;
type Item = Municipality & { intro?: TravelMunicipal; routes: TravelRoute[]; population?: number };

const GOLD = '#E2B277';

/**
 * Başkanlarla Keşif (tasarım: bursa-belediye-kesif.html; kurallar PROJE.md 5.2, Eren onayladı): her ilçeyi kendi
 * belediyesi tanıtır. Puan yok; bütün ilçeler aynı boyutta satır; sıralama nüfusa göre; "Belediye tanıtımı" etiketi;
 * seçim döneminde başkan adı gizlenir. İl tanıtımı (büyükşehir / il belediyesi) en üstte büyük fotoğraflı kartta.
 * Tanıtımı olmayan ilçe de listede kalır ("Tanıtım hazırlanıyor"), küçük ilçeler kaybolmaz.
 * Görünüm (12 Kasım 2026): iç ekranların ortak düzeni; il fotoğrafı tepede, ilçeler tek yüzeyde satır satır, dokununca açılır.
 */
export default function TravelMayorsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const bottom = usePageBottom();
  const duration = useDurationText();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { value: city } = useTravelCity(code);
  const { value: intros, failed, retry } = useTravelMunicipal(code);
  const { value: routes } = useTravelRoutes(code);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [playing, setPlaying] = useState<{ src: string; title: string } | null>(null);
  const name = repo.getProvince(code)?.name ?? '';
  const cover = city?.cover ?? undefined;
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
  const placeOf = (m: Item) => (m.scope.level === 'ilce' ? repo.getDistrict(m.scope.districtId)?.name ?? m.name : m.name);
  const mayorOf = (m: Item) => (m.intro?.showMayor && m.intro.mayorName ? m.intro.mayorName : undefined);

  /** Açılan tanıtım: kapak, yazı, belediyenin rotaları, video. */
  const details = (m: Item, place: string, withCover: boolean) => {
    const intro = m.intro!;
    return (
      <View style={styles.body}>
        {withCover && intro.cover ? <ThumbImage photo={intro.cover} style={[styles.cover, { aspectRatio: Math.min(2, Math.max(1, intro.cover.width / intro.cover.height)), backgroundColor: c.surfaceStrong }]} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
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

  /** İl tanıtımı: büyük fotoğraflı kart (belediyenin kapağı, yoksa belediye resmi). */
  const provinceCard = (m: Item) => {
    const intro = m.intro;
    const expanded = open === m.id;
    const mayor = mayorOf(m);
    const label = [t('travel.provinceIntro'), name, m.name, mayor, intro?.slogan ?? t('travel.introPreparing')].filter(Boolean).join('. ');
    const frame = [styles.featured, { borderColor: expanded ? c.accentBorder : 'rgba(226, 178, 119, 0.45)', backgroundColor: c.surface }];
    // Geniş afiş (ör. bütün başkanların yan yana olduğu fotoğraf, 12 Kasım 2026): kesilmesin diye tam genişlikte, yazı altında.
    const ratio = intro?.cover ? intro.cover.width / intro.cover.height : 0;
    if (intro?.cover && ratio >= 2.2) {
      return (
        <View style={frame}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={label}
            onPress={() => setOpen(expanded ? null : m.id)}
            style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
            <View style={[styles.banner, { aspectRatio: Math.min(ratio, 3.2), backgroundColor: c.surfaceStrong }]}>
              <ThumbImage photo={intro.cover} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
              <View style={styles.badge}>
                <MaterialIcons name="location-city" size={13} color="#081F24" />
                <AppText style={styles.badgeText}>{t('travel.provinceIntro').toLocaleUpperCase(i18n.language)}</AppText>
              </View>
            </View>
            <View style={styles.bannerFoot}>
              <View style={styles.flex}>
                <AppText style={[styles.bannerTitle, { color: c.textStrong }]} numberOfLines={2}>{m.name}</AppText>
                {mayor ? <AppText style={[styles.sub, { color: c.textMuted }]} numberOfLines={1}>{t('travel.mayorOf', { name: mayor })}</AppText> : null}
                <AppText style={[styles.slogan, { color: c.text }]} numberOfLines={expanded ? undefined : 2}>{intro.slogan}</AppText>
              </View>
              <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={24} color={c.textSoft} />
            </View>
          </Pressable>
          {expanded ? <View style={styles.bannerBody}>{details(m, name, false)}</View> : null}
        </View>
      );
    }
    return (
      <View style={frame}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={intro ? { expanded } : { disabled: true }}
          disabled={!intro}
          accessibilityLabel={label}
          onPress={() => setOpen(expanded ? null : m.id)}
          style={({ pressed }) => [styles.featuredArt, { opacity: pressed ? 0.92 : 1 }]}>
          {intro?.cover ? (
            <ThumbImage photo={intro.cover} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
          ) : (
            <Image source={TOWNHALL_ART} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="right" accessible={false} />
          )}
          <BottomShade />
          <View style={styles.badge}>
            <MaterialIcons name="location-city" size={13} color="#081F24" />
            <AppText style={styles.badgeText}>{t('travel.provinceIntro').toLocaleUpperCase(i18n.language)}</AppText>
          </View>
          <View style={styles.featuredFoot}>
            <View style={styles.flex}>
              <AppText style={styles.featuredTitle} numberOfLines={2}>{m.name}</AppText>
              {mayor ? <AppText style={styles.featuredMeta} numberOfLines={1}>{t('travel.mayorOf', { name: mayor })}</AppText> : null}
              <AppText style={[styles.featuredSlogan, !intro && styles.dimText]} numberOfLines={expanded ? undefined : 2}>
                {intro?.slogan ?? t('travel.introPreparing')}
              </AppText>
            </View>
            {intro ? (
              <View style={styles.more}>
                <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={22} color="#FFFFFF" />
              </View>
            ) : null}
          </View>
        </Pressable>
        {expanded && intro ? details(m, name, false) : null}
      </View>
    );
  };

  /** İlçe satırı: hepsi aynı boyutta (Eren onayladı: büyük-küçük ilçe ayrımı yok). */
  const districtRow = (m: Item, first: boolean) => {
    const intro = m.intro;
    const expanded = open === m.id;
    const place = placeOf(m);
    const mayor = mayorOf(m);
    const sub = [m.name, mayor ? t('travel.mayorOf', { name: mayor }) : undefined].filter(Boolean).join(' · ');
    return (
      <View key={m.id} style={!first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={intro ? { expanded } : { disabled: true }}
          disabled={!intro}
          accessibilityLabel={[place, sub, intro?.slogan ?? t('travel.introPreparing'), t('travel.municipalTag')].filter(Boolean).join('. ')}
          onPress={() => setOpen(expanded ? null : m.id)}
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.75 : 1 }]}>
          {intro?.cover ? (
            <ThumbImage photo={intro.cover} style={[styles.thumb, { backgroundColor: c.surfaceStrong }]} contentFit="cover" accessibilityIgnoresInvertColors />
          ) : (
            <View style={[styles.thumb, styles.monogram, { backgroundColor: intro ? c.accentSoft : c.surfaceStrong }]}>
              <AppText style={[styles.monogramText, { color: intro ? c.accent : c.textSoft }]}>{place.slice(0, 1).toLocaleUpperCase(i18n.language)}</AppText>
            </View>
          )}
          <View style={styles.flex}>
            <View style={styles.titleRow}>
              <AppText style={[styles.place, { color: c.textStrong }]} numberOfLines={1}>{place}</AppText>
              {intro?.zone ? (
                <View style={[styles.zone, { borderColor: c.border }]}>
                  <AppText style={[styles.zoneText, { color: c.textMuted }]}>{t(`travel.zones.${intro.zone}`)}</AppText>
                </View>
              ) : null}
            </View>
            <AppText style={[styles.sub, { color: c.textMuted }]} numberOfLines={1}>{sub}</AppText>
            <AppText style={[styles.slogan, { color: intro ? c.text : c.textSoft }, !intro && styles.italic]} numberOfLines={expanded ? undefined : 1}>
              {intro?.slogan ?? t('travel.introPreparing')}
            </AppText>
          </View>
          {intro ? (
            <View style={styles.trail}>
              {m.routes.length ? (
                <View style={[styles.count, { backgroundColor: c.accentSoft }]}>
                  <MaterialIcons name="route" size={12} color={c.accent} />
                  <AppText style={[styles.countText, { color: c.accent }]}>{m.routes.length}</AppText>
                </View>
              ) : null}
              {intro.videoUrl ? <MaterialIcons name="play-circle-outline" size={18} color={c.accent} /> : null}
              <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={22} color={c.textSoft} />
            </View>
          ) : null}
        </Pressable>
        {expanded && intro ? details(m, place, true) : null}
      </View>
    );
  };

  return (
    <Screen bleed cover={cover}>
      <ScrollView contentContainerStyle={[PAGE_CONTENT, styles.content, { paddingBottom: bottom }]} showsVerticalScrollIndicator={false}>
        <PageHead cover={cover} extend={6} title={t('travel.mayorsTitle')} subtitle={name} onBack={back} />
        <AppText style={[styles.intro, { color: c.textMuted }]}>{t('travel.mayorsIntro', { count: districts.length })}</AppText>

        {failed && !intros ? <StateMessage kind="error" onRetry={retry} /> : intros === null ? <StateMessage kind="loading" /> : null}
        {province && filter === 'all' ? provinceCard(province) : null}

        <SectionTitle title={t('travel.districtList')} aside={t('city.hub.districts', { count: shown.length })} />
        {zones.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={BLEED_STRIP} contentContainerStyle={[BLEED_STRIP_CONTENT, styles.filters]}>
            {(['all', ...zones] as Filter[]).map((f) => (
              <FilterChip key={f} small label={f === 'all' ? t('travel.all') : t(`travel.zones.${f}`)} active={f === filter} onPress={() => setFilter(f)} />
            ))}
          </ScrollView>
        ) : null}
        {shown.length ? <ListSurface>{shown.map((d, i) => districtRow(d, i === 0))}</ListSurface> : null}

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
  featured: { borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  featuredArt: { height: 188, justifyContent: 'space-between', padding: spacing.md, overflow: 'hidden' },
  banner: { width: '100%', padding: spacing.sm + 2, overflow: 'hidden' },
  bannerFoot: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  bannerTitle: { fontFamily: fonts.display, fontSize: 20, lineHeight: 25 },
  bannerBody: { paddingHorizontal: spacing.md - 2 },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: GOLD, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { color: '#081F24', fontFamily: fonts.bodySemi, fontSize: 9.5, letterSpacing: 1 },
  featuredFoot: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  featuredTitle: { color: white, fontFamily: fonts.display, fontSize: 21, lineHeight: 26 },
  featuredMeta: { color: 'rgba(255,255,255,0.75)', fontSize: 12, lineHeight: 16 },
  featuredSlogan: { color: 'rgba(255,255,255,0.92)', fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, marginTop: 2 },
  dimText: { color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' },
  more: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 72, paddingVertical: spacing.sm + 2 },
  thumb: { width: 48, height: 48, borderRadius: radius.md, overflow: 'hidden' },
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
