import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CityGuideSectionId } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { GlossyIcon } from '@/components/glossy-icon';
import { HeroHeader } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useCityGuideMeta } from '@/lib/city-guide';
import { LOOK, type Look } from '@/lib/city-look';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { fonts, GUTTER, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

interface Tile {
  key: string;
  look: Look;
  href?: Href;
  /** Açılması için bilgisi olması gereken bölümler (biri yeterli). Yoksa ve href yoksa "yakında". */
  needs?: CityGuideSectionId[];
}

// Sıra ve adlar Eren'in tasarımındaki gibi (benim-sehrim.html): Belediye Hizmetleri büyük kartta, 11 simge.
const TILES: Tile[] = [
  { key: 'kurumlar', look: LOOK.kurumlar, href: '/city/kurumlar', needs: ['onemli-kurumlar', 'muhtarliklar', 'toplanma-alanlari'] },
  { key: 'muzeler', look: LOOK.muzeler, href: { pathname: '/city/[section]', params: { section: 'muzeler' } }, needs: ['muzeler'] },
  { key: 'cafe', look: LOOK.cafe, href: '/city/food' },
  { key: 'events', look: LOOK.etkinlik, href: '/events' },
  { key: 'pharmacy', look: LOOK.eczane },
  { key: 'ulasim', look: LOOK.ulasim, href: { pathname: '/city/[section]', params: { section: 'ulasim' } }, needs: ['ulasim'] },
  { key: 'parkPazar', look: LOOK.parkPazar, href: '/city/park-pazar', needs: ['parklar', 'pazarlar'] },
  { key: 'listings', look: LOOK.emlak },
  { key: 'otopark', look: LOOK.otopark, href: { pathname: '/city/[section]', params: { section: 'otoparklar' } }, needs: ['otoparklar'] },
  { key: 'volunteer', look: LOOK.gonullu },
  { key: 'howTo', look: LOOK.rehber, href: { pathname: '/city/[section]', params: { section: 'nasil-yapilir' } } },
];

/**
 * Benim Şehrim = Şehir Paneli (tasarım: benim-sehrim.html): üstte konum, "Bugün" kartı, Belediye Hizmetleri büyük
 * kartı ve parlak simgeli 11 bölüm, altta Mahalle Meydanı ve Şehir Vitrini. Bilgisi olmayan bölüm soluk ve "Yakında".
 * Hava durumu verisi gelene kadar "Bugün" kartında tarih ve konum durur (uydurma derece yok).
 */
export default function MyCityScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const { width } = useWindowDimensions();
  const { location } = useUserLocation();
  const provinceCode = location?.provinceCode;
  const { meta, stale, failed } = useCityGuideMeta(provinceCode);
  const province = provinceCode ? repo.getProvince(provinceCode)?.name : undefined;
  const district = location?.districtId ? repo.getDistrict(location.districtId)?.name : undefined;
  const [neighbourhood, setNeighbourhood] = useState<string>();

  useEffect(() => {
    setNeighbourhood(undefined);
    const { districtId, neighbourhoodId } = location ?? {};
    if (!districtId || !neighbourhoodId) return;
    repo
      .getNeighbourhoods(districtId)
      .then((list) => setNeighbourhood(list.find((n) => n.id === neighbourhoodId)?.name))
      .catch(() => {});
  }, [location]);

  const header = (
    <HeroHeader
      title={t('city.panelTitle')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
      right={{ icon: 'notifications-none', label: t('notifications.title'), onPress: () => router.push('/notifications') }}>
      {province ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${[district, province].filter(Boolean).join(', ')}. ${t('home.changeLocation')}`}
          onPress={() => router.push('/location?edit=1')}
          style={styles.locRow}>
          <MaterialIcons name="location-on" size={14} color={c.heroAccent} />
          <AppText style={[styles.locText, { color: c.heroMuted }]}>{[district, province].filter(Boolean).join(', ')}</AppText>
          <MaterialIcons name="expand-more" size={16} color={c.heroMuted} />
        </Pressable>
      ) : null}
    </HeroHeader>
  );

  if (!provinceCode) {
    return (
      <Screen header={header}>
        <View style={styles.content}>
          <StateMessage kind="empty" message={t('city.needLocation')} />
          <AppButton title={t('home.changeLocation')} onPress={() => router.push('/location?edit=1')} />
        </View>
      </Screen>
    );
  }

  const count = (s: CityGuideSectionId) => meta?.sections[s]?.count ?? 0;
  const ready = (x: Tile) => !!x.href && (!x.needs || x.needs.some((s) => count(s) > 0));
  const GAP = 12;
  const inner = Math.min(width, 640) - GUTTER * 2;
  const cell = Math.floor((inner - GAP * 3) / 4);
  const iconSize = Math.min(58, cell - 14);
  const townhallReady = count('belediye-hizmetleri') > 0;

  const tile = (x: Tile) => {
    const on = ready(x);
    const label = t(`city.tiles.${x.key}`);
    return (
      <Pressable
        key={x.key}
        accessibilityRole="button"
        accessibilityLabel={on ? label : `${label}. ${t('city.soon')}`}
        disabled={!on}
        onPress={() => router.push(x.href!)}
        style={({ pressed }) => [styles.tile, { width: cell, transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
        <GlossyIcon icon={x.look.icon} colors={x.look.colors} size={iconSize} dim={!on} />
        <AppText numberOfLines={2} style={[styles.tileText, { color: on ? c.textStrong : c.textSoft }]}>{label}</AppText>
        {!on ? <AppText style={[styles.soon, { color: c.textSoft }]}>{t('city.soon')}</AppText> : null}
      </Pressable>
    );
  };

  const wide = (key: string, look: Look, title: string, hint: string, href: Href) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}`}
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.wide, { backgroundColor: c.surface, borderColor: c.border, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      <GlossyIcon icon={look.icon} colors={look.colors} size={52} />
      <View style={styles.flex}>
        <AppText style={[styles.wideTitle, { color: c.textStrong }]} numberOfLines={1}>{title}</AppText>
        <AppText style={[styles.wideHint, { color: c.textMuted }]} numberOfLines={1}>{hint}</AppText>
      </View>
      <View style={[styles.arrow, { backgroundColor: c.surfaceStrong }]}>
        <MaterialIcons name="arrow-forward" size={18} color={c.textStrong} />
      </View>
    </Pressable>
  );

  const today = new Date();

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Bugün: hava durumu verisi gelince derece burada görünecek. */}
        <View style={[styles.today, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={[styles.sun, { backgroundColor: c.accentSoft }]}>
            <MaterialIcons name="today" size={22} color={c.accent} />
          </View>
          <View style={styles.flex}>
            <AppText style={[styles.todayDate, { color: c.textStrong }]}>{today.toLocaleDateString(i18n.language, { day: 'numeric', month: 'long' })}</AppText>
            <AppText style={[styles.todaySub, { color: c.textMuted }]}>
              {[today.toLocaleDateString(i18n.language, { weekday: 'long' }), neighbourhood ?? district].filter(Boolean).join(' · ')}
            </AppText>
          </View>
          <View style={styles.todayRight}>
            <AppText style={[styles.todayLabel, { color: c.textSoft }]}>{t('city.today')}</AppText>
            <AppText style={[styles.live, { color: c.success }]}>● {province?.toLocaleUpperCase(lang)}</AppText>
          </View>
        </View>
        {stale ? <AppText variant="caption" muted>{t('city.staleNote')}</AppText> : null}
        {failed && !meta ? <StateMessage kind="error" message={t('city.loadError')} /> : !meta ? <StateMessage kind="loading" /> : null}

        <View style={[styles.grid, { gap: GAP }]}>
          <View style={[styles.row, { gap: GAP }]}>
            {/* Belediye Hizmetleri: tasarımdaki büyük altın kart. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={townhallReady ? t('city.townhall') : `${t('city.townhall')}. ${t('city.soon')}`}
              disabled={!townhallReady}
              onPress={() => router.push({ pathname: '/city/[section]', params: { section: 'belediye-hizmetleri' } })}
              style={({ pressed }) => [
                styles.big,
                { width: cell * 2 + GAP, backgroundColor: c.surface, borderColor: c.accentBorder, opacity: townhallReady ? 1 : 0.6, transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}>
              <View style={styles.bigTop}>
                <GlossyIcon icon={LOOK.belediye.icon} colors={LOOK.belediye.colors} size={54} />
                <View style={[styles.bigArrow, { borderColor: c.border }]}>
                  <MaterialIcons name="north-east" size={16} color={c.textMuted} />
                </View>
              </View>
              <View>
                <AppText style={[styles.bigTitle, { color: c.textStrong }]}>{t('city.townhall')}</AppText>
                <AppText style={[styles.bigHint, { color: c.textMuted }]}>{townhallReady ? t('city.townhallHint') : t('city.soon')}</AppText>
              </View>
            </Pressable>
            <View style={[styles.wrap, { width: cell * 2 + GAP, gap: GAP }]}>{TILES.slice(0, 4).map(tile)}</View>
          </View>
          <View style={[styles.wrap, { gap: GAP }]}>{TILES.slice(4).map(tile)}</View>
        </View>

        {wide('meydan', LOOK.meydan, t('neighbourhood.title'), neighbourhood ? t('city.meydanHint', { name: neighbourhood }) : t('neighbourhood.hint'), '/neighbourhood')}
        {wide('vitrin', LOOK.vitrin, t('showcase.title', { city: province ?? '' }), t('city.vitrinHint'), '/city/showcase')}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  flex: { flex: 1, gap: 2 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'center', minHeight: 28 },
  locText: { fontSize: 13 },
  today: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.xl, borderWidth: 1 },
  sun: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  todayDate: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28 },
  todaySub: { fontSize: 12, lineHeight: 16, textTransform: 'capitalize' },
  todayRight: { alignItems: 'flex-end', gap: 2 },
  todayLabel: { fontSize: 12 },
  live: { fontFamily: fonts.bodySemi, fontSize: 10, letterSpacing: 0.8 },
  grid: {},
  row: { flexDirection: 'row' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { alignItems: 'center', gap: 6, paddingTop: 2, paddingBottom: 4 },
  tileText: { fontFamily: fonts.bodySemi, fontSize: 11, lineHeight: 14, textAlign: 'center' },
  soon: { fontSize: 9, marginTop: -4 },
  big: { borderRadius: radius.xl, borderWidth: 1, padding: spacing.md, justifyContent: 'space-between', minHeight: 196 },
  bigTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  bigArrow: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bigTitle: { fontFamily: fonts.display, fontSize: 21, lineHeight: 26 },
  bigHint: { fontSize: 12, lineHeight: 16, marginTop: 4 },
  wide: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.xl, borderWidth: 1 },
  wideTitle: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 22 },
  wideHint: { fontSize: 12, lineHeight: 16 },
  arrow: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
