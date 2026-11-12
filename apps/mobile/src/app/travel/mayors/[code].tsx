import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { byPopulation, DISTRICT_ZONES, type DistrictZone, type Municipality, type TravelMunicipal, type TravelRoute } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { BottomShade, TOWNHALL_ART } from '@/components/city-tiles';
import { FilterChip, ListSurface, SectionTitle } from '@/components/inner';
import { BLEED_STRIP, BLEED_STRIP_CONTENT, PageHead, PAGE_CONTENT, usePageBottom } from '@/components/page-head';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { ThumbImage } from '@/components/thumb-image';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { cityMunicipalities, useTravelMunicipal, useTravelRoutes } from '@/lib/travel';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type Filter = 'all' | DistrictZone;
type Item = Municipality & { intro?: TravelMunicipal; routes: TravelRoute[]; population?: number };

/**
 * Başkanlarla Keşif (tasarım: bursa-belediye-kesif.html; kurallar PROJE.md 5.2, Eren onayladı): her ilçeyi kendi
 * belediyesi tanıtır. Puan yok; bütün ilçeler aynı boyutta satır; sıralama nüfusa göre; "Belediye tanıtımı" etiketi;
 * seçim döneminde başkan adı gizlenir. En üstte "Yerel Yönetimler" kartı (büyükşehir / il belediyesi).
 * Tanıtımı olmayan ilçe de listede kalır ("Tanıtım hazırlanıyor"), küçük ilçeler kaybolmaz.
 * 12 Kasım 2026 (Eren): tepede il fotoğrafı yok; satırda üstte başkan adı, altta belediye adı; dokununca belediyenin
 * ayrı tanıtım sayfası açılır (/travel/municipality/[id]).
 */
export default function TravelMayorsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { rtl } = useSettings();
  const bottom = usePageBottom();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { value: intros, failed, retry } = useTravelMunicipal(code);
  const { value: routes } = useTravelRoutes(code);
  const [filter, setFilter] = useState<Filter>('all');
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

  const placeOf = (m: Item) => (m.scope.level === 'ilce' ? repo.getDistrict(m.scope.districtId)?.name ?? m.name : m.name);
  const mayorOf = (m: Item) => (m.intro?.showMayor && m.intro.mayorName ? m.intro.mayorName : undefined);
  const openPage = (m: Item) => router.push({ pathname: '/travel/municipality/[id]', params: { id: m.id } });
  const chevron = rtl ? 'chevron-left' : 'chevron-right';

  /** Yerel Yönetimler kartı (büyükşehir / il belediyesi). */
  const provinceCard = (m: Item) => {
    const intro = m.intro;
    const mayor = mayorOf(m);
    // Eren (12 Kasım 2026): kartta belediye adı yerine "Yerel Yönetimler", "İl tanıtımı" etiketi yok.
    const title = t('travel.localGov');
    const slogan = intro ? intro.slogan : t('travel.introPreparing');
    const label = [title, name, mayor, slogan].filter(Boolean).join('. ');
    const frame = [styles.featured, { borderColor: 'rgba(226, 178, 119, 0.45)', backgroundColor: c.surface }];
    // Geniş afiş (ör. bütün başkanların yan yana olduğu fotoğraf): kesilmesin diye tam genişlikte, yazı altında.
    const ratio = intro?.cover ? intro.cover.width / intro.cover.height : 0;
    if (intro?.cover && ratio >= 2.2) {
      return (
        <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => openPage(m)} style={({ pressed }) => [...frame, { opacity: pressed ? 0.92 : 1 }]}>
          <View style={[styles.banner, { aspectRatio: Math.min(ratio, 3.2), backgroundColor: c.surfaceStrong }]}>
            <ThumbImage photo={intro.cover} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
          </View>
          <View style={styles.bannerFoot}>
            <View style={styles.flex}>
              <AppText style={[styles.bannerTitle, { color: c.textStrong }]} numberOfLines={2}>{title}</AppText>
              {mayor ? <AppText style={[styles.sub, { color: c.textMuted }]} numberOfLines={1}>{t('travel.mayorOf', { name: mayor })}</AppText> : null}
              {slogan ? <AppText style={[styles.slogan, { color: c.text }]} numberOfLines={2}>{slogan}</AppText> : null}
            </View>
            <MaterialIcons name={chevron} size={24} color={c.textSoft} />
          </View>
        </Pressable>
      );
    }
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={intro ? undefined : { disabled: true }}
        disabled={!intro}
        accessibilityLabel={label}
        onPress={() => openPage(m)}
        style={({ pressed }) => [...frame, styles.featuredArt, { opacity: pressed ? 0.92 : 1 }]}>
        {intro?.cover ? (
          <ThumbImage photo={intro.cover} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
        ) : (
          <Image source={TOWNHALL_ART} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="right" accessible={false} />
        )}
        <BottomShade />
        <View style={styles.featuredFoot}>
          <View style={styles.flex}>
            <AppText style={styles.featuredTitle} numberOfLines={2}>{title}</AppText>
            {mayor ? <AppText style={styles.featuredMeta} numberOfLines={1}>{t('travel.mayorOf', { name: mayor })}</AppText> : null}
            {slogan ? <AppText style={[styles.featuredSlogan, !intro && styles.dimText]} numberOfLines={2}>{slogan}</AppText> : null}
          </View>
          {intro ? (
            <View style={styles.more}>
              <MaterialIcons name={chevron} size={22} color="#FFFFFF" />
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  /** İlçe satırı: hepsi aynı boyutta (Eren onayladı: büyük-küçük ilçe ayrımı yok). */
  const districtRow = (m: Item, first: boolean) => {
    const intro = m.intro;
    const place = placeOf(m);
    const mayor = mayorOf(m);
    // Eren (12 Kasım 2026): üstte başkan adı, altta belediye adı. Başkan adı yoksa (seçim dönemi) üstte ilçe adı.
    const top = mayor ?? place;
    const slogan = intro ? intro.slogan : t('travel.introPreparing');
    return (
      <Pressable
        key={m.id}
        accessibilityRole="button"
        accessibilityState={intro ? undefined : { disabled: true }}
        disabled={!intro}
        accessibilityLabel={[top, m.name, slogan, t('travel.municipalTag')].filter(Boolean).join('. ')}
        onPress={() => openPage(m)}
        style={({ pressed }) => [styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }, { opacity: pressed ? 0.75 : 1 }]}>
        {intro?.cover ? (
          <ThumbImage photo={intro.cover} style={[styles.thumb, { backgroundColor: c.surfaceStrong }]} contentFit="cover" accessibilityIgnoresInvertColors />
        ) : (
          <View style={[styles.thumb, styles.monogram, { backgroundColor: intro ? c.accentSoft : c.surfaceStrong }]}>
            <AppText style={[styles.monogramText, { color: intro ? c.accent : c.textSoft }]}>{place.slice(0, 1).toLocaleUpperCase(i18n.language)}</AppText>
          </View>
        )}
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <AppText style={[styles.place, { color: c.textStrong }]} numberOfLines={1}>{top}</AppText>
            {intro?.zone ? (
              <View style={[styles.zone, { borderColor: c.border }]}>
                <AppText style={[styles.zoneText, { color: c.textMuted }]}>{t(`travel.zones.${intro.zone}`)}</AppText>
              </View>
            ) : null}
          </View>
          <AppText style={[styles.sub, { color: c.textMuted }]} numberOfLines={1}>{m.name}</AppText>
          {slogan ? (
            <AppText style={[styles.slogan, { color: intro ? c.text : c.textSoft }, !intro && styles.italic]} numberOfLines={1}>
              {slogan}
            </AppText>
          ) : null}
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
            <MaterialIcons name={chevron} size={22} color={c.textSoft} />
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <Screen bleed>
      <ScrollView contentContainerStyle={[PAGE_CONTENT, styles.content, { paddingBottom: bottom }]} showsVerticalScrollIndicator={false}>
        <PageHead title={t('travel.mayorsTitle')} subtitle={name} onBack={back} />
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
  featuredArt: { height: 188, justifyContent: 'flex-end', padding: spacing.md },
  banner: { width: '100%', overflow: 'hidden' },
  bannerFoot: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  bannerTitle: { fontFamily: fonts.display, fontSize: 20, lineHeight: 25 },
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
  noteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  note: { fontSize: 11, lineHeight: 15, textAlign: 'center' },
});
