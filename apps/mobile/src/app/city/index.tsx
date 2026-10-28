import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CITY_GUIDE_SECTIONS, type CityGuideSectionId } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { HeroHeader } from '@/components/hero-header';
import { SceneArt, sceneRim, type SceneKind } from '@/components/scene-art';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useCityGuideMeta } from '@/lib/city-guide';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { fonts, GUTTER, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/** Her kutucuğun kendi rengi (simge ve hafif hale); koyu ve açık zeminde okunur tonlar. */
const HUES = {
  gold: '#D9A15C',
  teal: '#2FB3A3',
  blue: '#5B9BE6',
  rose: '#E07A9B',
  green: '#3DBB8C',
  violet: '#9B87E8',
  amber: '#E6A23C',
} as const;
type Hue = keyof typeof HUES;

interface Tile {
  key: string;
  icon: IconName;
  hue: Hue;
  /** Şehir rehberi bölümü (veri sayısına göre açılır) ya da doğrudan bir ekran; ikisi de yoksa "yakında". */
  section?: CityGuideSectionId;
  href?: Href;
}

// Sıra Eren'in tasarımındaki gibi; Belediye Hizmetleri ayrıca büyük kartta.
const TILES: Tile[] = [
  { key: 'onemli-kurumlar', section: 'onemli-kurumlar', icon: 'account-balance', hue: 'blue' },
  { key: 'muzeler', section: 'muzeler', icon: 'museum', hue: 'gold' },
  { key: 'cafe', icon: 'restaurant', hue: 'amber' },
  { key: 'events', href: '/events', icon: 'event', hue: 'rose' },
  { key: 'pharmacy', icon: 'local-pharmacy', hue: 'green' },
  { key: 'ulasim', section: 'ulasim', icon: 'directions-bus', hue: 'blue' },
  { key: 'parklar', section: 'parklar', icon: 'park', hue: 'green' },
  { key: 'pazarlar', section: 'pazarlar', icon: 'storefront', hue: 'amber' },
  { key: 'listings', icon: 'sell', hue: 'violet' },
  { key: 'otoparklar', section: 'otoparklar', icon: 'local-parking', hue: 'teal' },
  { key: 'toplanma-alanlari', section: 'toplanma-alanlari', icon: 'emergency-share', hue: 'rose' },
  { key: 'muhtarliklar', section: 'muhtarliklar', icon: 'location-city', hue: 'teal' },
  { key: 'volunteer', icon: 'volunteer-activism', hue: 'rose' },
  { key: 'nasil-yapilir', section: 'nasil-yapilir', icon: 'lightbulb', hue: 'gold' },
];

/**
 * Benim Şehrim (PROJE.md 5.1, 13. madde 29; Eren onayladı): üstte şehrin kapağı, altında tek ızgara (Belediye
 * Hizmetleri büyük, diğer bölümler kendi renginde), en altta Mahalle Meydanı ve Şehir Vitrini. Bölümler veritabanından,
 * il başına gelir; bilgisi olmayan bölüm soluk "Yakında" görünür.
 */
export default function MyCityScreen() {
  const { t } = useTranslation();
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
      title={t('modules.myCity')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
      right={{ icon: 'edit-location-alt', label: t('home.changeLocation'), onPress: () => router.push('/location?edit=1') }}
    />
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

  // Üç sütunlu ızgara: Belediye Hizmetleri 2x2, yanında iki küçük kutu, gerisi üçerli.
  const GAP = 10;
  const inner = Math.min(width, 640) - GUTTER * 2;
  const cell = Math.floor((inner - GAP * 2) / 3);
  const sectionName = (id: CityGuideSectionId) => {
    const s = CITY_GUIDE_SECTIONS.find((x) => x.id === id);
    return s ? (s.names[lang] ?? s.names.tr) : id;
  };
  const tileState = (tile: Tile) => {
    if (tile.href) return { ready: true, label: t(`city.tiles.${tile.key}`) };
    if (!tile.section) return { ready: false, label: t(`city.tiles.${tile.key}`) };
    const count = meta?.sections[tile.section]?.count ?? 0;
    // "Nasıl yapılır?" ülke geneli içerikle de dolar; il boş olsa da açılır.
    return { ready: !!meta && (count > 0 || tile.section === 'nasil-yapilir'), label: sectionName(tile.section) };
  };
  const open = (tile: Tile) => (tile.href ? router.push(tile.href) : router.push({ pathname: '/city/[section]', params: { section: tile.section! } }));

  const renderTile = (tile: Tile) => {
    const { ready, label } = tileState(tile);
    const hue = HUES[tile.hue];
    return (
      <Pressable
        key={tile.key}
        accessibilityRole="button"
        accessibilityLabel={ready ? label : `${label}. ${t('city.soon')}`}
        disabled={!ready}
        onPress={() => open(tile)}
        style={({ pressed }) => [
          styles.tile,
          { width: cell, height: 92, backgroundColor: c.surface, borderColor: c.border, opacity: !ready ? 0.5 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        ]}>
        <View style={[styles.halo, { backgroundColor: `${hue}26` }]} />
        <View style={[styles.chip, { backgroundColor: `${hue}29` }]}>
          <MaterialIcons name={tile.icon} size={19} color={hue} />
        </View>
        {!ready ? <AppText style={[styles.soon, { backgroundColor: c.surfaceStrong, color: c.textMuted }]}>{t('city.soon')}</AppText> : null}
        <AppText numberOfLines={2} style={[styles.tileTitle, { color: c.textStrong }]}>{label}</AppText>
      </Pressable>
    );
  };

  const townhall = tileState({ key: 'belediye-hizmetleri', section: 'belediye-hizmetleri', icon: 'apartment', hue: 'gold' });
  const featured: { key: string; scene: SceneKind; tag: string; title: string; href?: Href }[] = [
    { key: 'neighbourhood', scene: 'neighbourhood', tag: t('neighbourhood.title'), title: neighbourhood ?? t('neighbourhood.hint'), href: '/neighbourhood' },
    { key: 'showcase', scene: 'showcase', tag: t('city.showcase'), title: province ?? '' },
  ];

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Şehir kapağı: fotoğraflar panelden yüklenebilir olunca (Storage) çizimin yerini alacak. */}
        <View style={[styles.cover, { borderColor: c.border }]}>
          <SceneArt kind="cover" />
          <View style={styles.coverText}>
            <AppText style={[styles.kicker, { color: c.heroAccent }]}>{t('modules.myCity').toLocaleUpperCase(lang)}</AppText>
            <AppText accessibilityRole="header" style={styles.cityName}>{province}</AppText>
            <AppText style={styles.place}>{[district, neighbourhood].filter(Boolean).join(' · ')}</AppText>
          </View>
        </View>
        {stale ? <AppText variant="caption" muted>{t('city.staleNote')}</AppText> : null}
        {failed && !meta ? <StateMessage kind="error" message={t('city.loadError')} /> : !meta ? <StateMessage kind="loading" /> : null}

        <View style={[styles.grid, { gap: GAP }]}>
          <View style={[styles.row, { gap: GAP }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={townhall.ready ? townhall.label : `${townhall.label}. ${t('city.soon')}`}
              disabled={!townhall.ready}
              onPress={() => router.push({ pathname: '/city/[section]', params: { section: 'belediye-hizmetleri' } })}
              style={({ pressed }) => [styles.big, { width: cell * 2 + GAP, height: 92 * 2 + GAP, borderColor: sceneRim('townhall'), opacity: !townhall.ready ? 0.6 : pressed ? 0.88 : 1 }]}>
              <SceneArt kind="townhall" />
              <View style={styles.bigIcon}>
                <MaterialIcons name="apartment" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.foot}>
                <AppText style={styles.bigTitle}>{townhall.label}</AppText>
                <AppText style={styles.footHint}>{townhall.ready ? t('city.townhallHint') : t('city.soon')}</AppText>
              </View>
            </Pressable>
            <View style={{ gap: GAP }}>{TILES.slice(0, 2).map(renderTile)}</View>
          </View>
          <View style={[styles.wrap, { gap: GAP }]}>{TILES.slice(2).map(renderTile)}</View>
        </View>

        <View style={[styles.row, { gap: GAP }]}>
          {featured.map((f) => (
            <Pressable
              key={f.key}
              accessibilityRole="button"
              accessibilityLabel={f.href ? `${f.tag}. ${f.title}` : `${f.tag}. ${t('city.soon')}`}
              disabled={!f.href}
              onPress={f.href ? () => router.push(f.href!) : undefined}
              style={({ pressed }) => [styles.featured, { borderColor: sceneRim(f.scene), opacity: !f.href ? 0.6 : pressed ? 0.88 : 1 }]}>
              <SceneArt kind={f.scene} />
              <View style={styles.foot}>
                <AppText numberOfLines={1} style={[styles.featuredTag, { color: c.heroAccent }]}>{f.tag.toLocaleUpperCase(lang)}</AppText>
                <AppText numberOfLines={1} style={styles.featuredTitle}>{f.href ? f.title : t('city.soon')}</AppText>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const white = '#FFFFFF';
const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  cover: { height: 172, borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  coverText: { position: 'absolute', start: 0, end: 0, bottom: 0, paddingHorizontal: spacing.md, paddingVertical: 10, backgroundColor: 'rgba(8, 26, 30, 0.6)' },
  kicker: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 1 },
  cityName: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 34, color: white },
  place: { fontSize: 13, color: '#D5E2E3' },
  grid: {},
  row: { flexDirection: 'row' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { borderRadius: radius.lg, borderWidth: 1, padding: 10, justifyContent: 'space-between', overflow: 'hidden' },
  halo: { position: 'absolute', top: -18, end: -18, width: 64, height: 64, borderRadius: 32 },
  chip: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  soon: { position: 'absolute', top: 10, end: 8, fontFamily: fonts.bodySemi, fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' },
  tileTitle: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 16 },
  big: { borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  bigIcon: {
    position: 'absolute',
    top: 12,
    start: 12,
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 35, 40, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  foot: { position: 'absolute', start: 0, end: 0, bottom: 0, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: 'rgba(8, 26, 30, 0.72)' },
  bigTitle: { fontFamily: fonts.heading, fontSize: 16, lineHeight: 21, color: white },
  footHint: { fontSize: 12, lineHeight: 16, color: '#D5E2E3', marginTop: 2 },
  featured: { flex: 1, height: 124, borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  featuredTag: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 0.8 },
  featuredTitle: { fontFamily: fonts.heading, fontSize: 14, lineHeight: 19, color: white, marginTop: 2 },
});
