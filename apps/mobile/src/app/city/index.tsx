import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useId, useState, type ComponentProps, type ReactNode } from 'react';
import { Image } from 'expo-image';
import { I18nManager, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { CITY_GUIDE_SECTIONS, type CityGuideSectionId } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { frost } from '@/components/city-hub';
import { FrostFill } from '@/components/glass';
import { HeroHeader } from '@/components/hero-header';
import { LineIcon } from '@/components/line-icon';
import { CoverArt, SceneArt, type SceneKind } from '@/components/scene-art';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useCityGuideMeta } from '@/lib/city-guide';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { useTravelCity } from '@/lib/travel';
import { useUserLocation } from '@/lib/user-location';
import { fonts, GUTTER, radius, spacing } from '@/theme/tokens';
import { useResolvedScheme, useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const GOLD = '#E2B277';
const TEAL = '#4FC2A8';
// Eren'in taslağındaki görseller (8 Kasım 2026): her ilde aynı olan süsler. İlin kendi fotoğrafı panelden gelir.
// Eren'in ChatGPT ile hazırladığı resimler (8 Kasım 2026), her ilde aynı. Kaynakları masaüstündeki CityJoy-gorseller klasöründe.
const TOWNHALL_ART = require('../../../assets/city/belediye.jpg') as number;
const KURUMLAR_ART = require('../../../assets/city/kurumlar.jpg') as number;
const MAHALLE_ART = require('../../../assets/city/mahalle.jpg') as number;
const VITRIN_ART = require('../../../assets/city/vitrin.jpg') as number;
const SKYLINE_ART = require('../../../assets/city/siluet.jpg') as number;

interface Tile {
  key: string;
  icon: IconName;
  /** Simge rengi: altın ya da yeşil vurgu; yoksa yazı rengi. */
  tint?: 'gold' | 'teal';
  /** Şehir rehberi bölümü (veri sayısına göre açılır) ya da doğrudan bir ekran; ikisi de yoksa "yakında". */
  section?: CityGuideSectionId;
  href?: Href;
}

// Sıra Eren'in taslağındaki gibi (7 Kasım 2026): üstte Belediye Hizmetleri ile Önemli Kurumlar, altında iki sütunlu
// satırlar. Muhtarlıklar Önemli Kurumlar'ın içinde, toplanma alanları Mahalle Meydanı'nda.
const KURUMLAR: Tile = { key: 'kurumlar', href: '/city/kurumlar', icon: 'corporate-fare' };
const TILES: Tile[] = [
  { key: 'muzeler', section: 'muzeler', icon: 'museum' },
  { key: 'cafe', href: '/city/food', icon: 'restaurant' },
  { key: 'events', href: '/events', icon: 'event' },
  { key: 'pharmacy', icon: 'local-pharmacy', tint: 'gold' },
  { key: 'ulasim', section: 'ulasim', icon: 'directions-bus' },
  { key: 'parkPazar', href: '/city/park-pazar', icon: 'park', tint: 'teal' },
  { key: 'listings', href: '/carsi', icon: 'sell', tint: 'gold' },
  { key: 'otoparklar', section: 'otoparklar', icon: 'local-parking' },
  { key: 'volunteer', icon: 'volunteer-activism', tint: 'gold' },
  { key: 'nasil-yapilir', section: 'nasil-yapilir', icon: 'lightbulb', tint: 'gold' },
];

/**
 * Benim Şehrim (PROJE.md 5.1; Eren'in 7 Kasım 2026 taslağı): üstte ilin fotoğraflı kapağı (Seyahat bölümünde panelden
 * yüklenen il kapağı; yoksa çizim), "Şehrinde keşfet" altında altın Belediye kartı ve Önemli Kurumlar, sonra iki
 * sütunlu cam satırlar, en altta Mahalle Meydanı ve il Vitrini. Bilgisi olmayan bölüm soluk "Yakında" görünür.
 */
export default function MyCityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const dark = useResolvedScheme() === 'dark';
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const { location } = useUserLocation();
  const provinceCode = location?.provinceCode;
  const { meta, stale, failed } = useCityGuideMeta(provinceCode);
  const { value: travelCity } = useTravelCity(provinceCode);
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
      serif
      title={t('modules.myCity')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
      right={{ icon: 'edit-location-alt', label: t('home.changeLocation'), onPress: () => router.push('/location?edit=1') }}
    />
  );

  if (!provinceCode) {
    return (
      <Screen warm header={header}>
        <View style={styles.content}>
          <StateMessage kind="empty" message={t('city.needLocation')} />
          <AppButton title={t('home.changeLocation')} onPress={() => router.push('/location?edit=1')} />
        </View>
      </Screen>
    );
  }

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
  const tintOf = (tile: Tile) => (tile.tint === 'gold' ? GOLD : tile.tint === 'teal' ? TEAL : c.textStrong);
  const glass = frost(dark, c.surface, c.border);

  const soonChip = <AppText style={[styles.soon, { backgroundColor: c.surfaceStrong, color: c.textMuted }]}>{t('city.soon')}</AppText>;

  const renderRow = (tile: Tile) => {
    const { ready, label } = tileState(tile);
    return (
      <Pressable
        key={tile.key}
        accessibilityRole="button"
        accessibilityLabel={ready ? label : `${label}. ${t('city.soon')}`}
        accessibilityState={{ disabled: !ready }}
        disabled={!ready}
        onPress={() => open(tile)}
        style={({ pressed }) => [styles.row, glass, { opacity: !ready ? 0.5 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
        <FrostFill />
        <LineIcon name={tile.icon} size={24} color={tintOf(tile)} />
        <AppText numberOfLines={2} style={[styles.rowTitle, { color: c.textStrong }]}>{label}</AppText>
        {!ready ? soonChip : null}
        <Chevron />
      </Pressable>
    );
  };

  const townhall = tileState({ key: 'belediye-hizmetleri', section: 'belediye-hizmetleri', icon: 'apartment' });
  const kurumlar = tileState(KURUMLAR);
  const pairs: Tile[][] = [];
  for (let i = 0; i < TILES.length; i += 2) pairs.push(TILES.slice(i, i + 2));

  return (
    <Screen warm header={header}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* İl kapağı: Seyahat panelinde ile yüklenen fotoğraf; yoksa çizim. */}
        <View style={styles.cover}>
          {travelCity?.cover ? (
            <View style={styles.coverPhoto}>
              <CoverArt photo={travelCity.cover} kind="cover" />
            </View>
          ) : (
            <CoverArt kind="cover" />
          )}
          <Shade from="#0A2226" opacity={0.97} mid={0.72} to={0} />
          <View style={styles.coverText}>
            <AppText style={styles.kicker}>{t('modules.myCity').toLocaleUpperCase(lang)}</AppText>
            <AppText accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit style={styles.cityName}>{province}</AppText>
            {district || neighbourhood ? (
            <View style={styles.placeRow}>
              <LineIcon name="location-on" size={16} color={GOLD} />
              <AppText numberOfLines={1} style={styles.place}>{[district, neighbourhood].filter(Boolean).join(' · ')}</AppText>
            </View>
            ) : null}
          </View>
          <View pointerEvents="none" style={styles.coverRim} />
        </View>
        {stale ? <AppText variant="caption" muted>{t('city.staleNote')}</AppText> : null}
        {failed && !meta ? <StateMessage kind="error" message={t('city.loadError')} /> : !meta ? <StateMessage kind="loading" /> : null}

        <View style={styles.heading}>
          <View style={styles.headingIcon}>
            <LineIcon name="explore" size={17} color="#2A1C06" />
          </View>
          <AppText accessibilityRole="header" style={[styles.headingText, { color: c.textStrong }]}>{t('city.hub.explore')}</AppText>
          <View style={[styles.headingLine, { backgroundColor: c.border }]} />
        </View>

        <View style={styles.pair}>
          <PhotoCard
            flex={1.2}
            scene="townhall"
            image={TOWNHALL_ART}
            gold
            icon="account-balance"
            title={townhall.label}
            onPress={() => router.push('/city/belediyeler')}
          />
          <PhotoCard
            scene="townhall"
            image={KURUMLAR_ART}
            icon={KURUMLAR.icon}
            title={kurumlar.label}
            onPress={() => open(KURUMLAR)}
          />
        </View>

        {pairs.map((p) => (
          <View key={p[0].key} style={styles.pair}>
            {p.map(renderRow)}
          </View>
        ))}

        <View style={[styles.pair, styles.bottom]}>
          <PhotoCard
            scene="neighbourhood"
            image={MAHALLE_ART}
            icon="holiday-village"
            title={t('neighbourhood.title')}
            sub={neighbourhood ?? t('neighbourhood.hint')}
            onPress={() => router.push('/neighbourhood')}
          />
          <PhotoCard
            scene="showcase"
            image={VITRIN_ART}
            gold
            icon="auto-awesome"
            title={province ? t('city.hub.showcaseOf', { city: province }) : t('city.showcase')}
            sub={t('showcase.weekly')}
            onPress={() => router.push('/city/showcase')}
          />
        </View>

        {/* Taslaktaki şehir silüeti: sayfanın en altında, kenardan kenara. */}
        <View pointerEvents="none" style={styles.skyline}>
          <Image source={SKYLINE_ART} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
          <Fade color={c.background} />
        </View>
      </ScrollView>
    </Screen>
  );
}

/** Kartın soldan sağa koyulaşan örtüsü (fotoğraf üstündeki yazı okunsun). */
function Shade({ from, opacity, mid = 0.55, to = 0.15 }: { from: string; opacity: number; mid?: number; to?: number }) {
  const rtl = I18nManager.isRTL;
  const id = 'shade' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1={rtl ? '1' : '0'} y1="0" x2={rtl ? '0' : '1'} y2="0.3">
            <Stop offset="0" stopColor={from} stopOpacity={opacity} />
            <Stop offset="0.4" stopColor={from} stopOpacity={opacity * mid} />
            <Stop offset="1" stopColor={from} stopOpacity={to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** Silüetin üst kenarını sayfa zeminine eritir. */
function Fade({ color }: { color: string }) {
  const id = 'fade' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="0.45" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** Sağdaki küçük yuvarlak ok. */
function Chevron({ gold }: { gold?: boolean }) {
  const rtl = I18nManager.isRTL;
  return (
    <View style={[styles.chevron, gold ? styles.chevronGold : null]}>
      <MaterialIcons name={rtl ? 'chevron-left' : 'chevron-right'} size={18} color={gold ? '#2A1C06' : '#EAF1EF'} />
    </View>
  );
}

/** Fotoğraflı (şimdilik çizimli) büyük kart: Belediye, Mahalle Meydanı, Vitrin. `gold`: altın tonlu örtü. */
function PhotoCard({ scene, image, gold, icon, title, sub, flex = 1, onPress }: { scene: SceneKind; image?: number; gold?: boolean; icon: IconName; title: string; sub?: string; flex?: number; onPress(): void }): ReactNode {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={sub ? `${title}. ${sub}` : title}
      onPress={onPress}
      style={({ pressed }) => [styles.tall, styles.photoCard, { flex, borderColor: gold ? 'rgba(226, 178, 119, 0.55)' : 'rgba(220, 240, 236, 0.18)', transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
      {image ? (
        <View style={styles.cardArt}>
          <Image source={image} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="right" accessible={false} />
        </View>
      ) : (
        <SceneArt kind={scene} still />
      )}
      <Shade from={gold ? '#A87B3E' : '#061417'} opacity={image ? 1 : gold ? 0.95 : 0.88} mid={image ? 0.6 : 0.55} to={image ? 0 : gold ? 0.35 : 0.2} />
      <View>
        <LineIcon name={icon} size={30} color="#FFFFFF" />
      </View>
      <View style={styles.tallFoot}>
        <View style={styles.flex}>
          <AppText numberOfLines={2} style={styles.photoTitle}>{title}</AppText>
          {sub ? <AppText numberOfLines={1} style={styles.photoSub}>{sub}</AppText> : null}
        </View>
        <Chevron gold={gold} />
      </View>
    </Pressable>
  );
}

const white = '#FFFFFF';
const styles = StyleSheet.create({
  content: { gap: spacing.sm + 2, paddingBottom: spacing.xl },
  cover: { height: 184, borderRadius: radius.xl, borderWidth: 1, borderColor: 'rgba(220, 240, 236, 0.16)', overflow: 'hidden', justifyContent: 'center', backgroundColor: '#0A2226' },
  coverRim: { position: 'absolute', start: 0, end: 0, bottom: 0, height: 2, backgroundColor: GOLD, opacity: 0.7 },
  coverText: { paddingHorizontal: spacing.md + 2, gap: 2, maxWidth: '68%' },
  kicker: { alignSelf: 'flex-start', fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 1.4, color: GOLD, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(226, 178, 119, 0.6)' },
  cityName: { fontFamily: fonts.serifSemi, fontSize: 40, lineHeight: 48, color: white, marginTop: 4 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  place: { flexShrink: 1, fontSize: 13, color: '#E3ECEA' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.sm },
  headingIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  headingText: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 26 },
  headingLine: { flex: 1, height: 1, marginStart: 6 },
  pair: { flexDirection: 'row', gap: spacing.sm + 2 },
  bottom: { marginTop: spacing.sm },
  tall: { flex: 1, height: 128, borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden', padding: spacing.md - 2, justifyContent: 'space-between' },
  tallFoot: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  tallTitle: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 20 },
  photoCard: { backgroundColor: '#0B2327' },
  cardArt: { position: 'absolute', top: 0, bottom: 0, end: 0, width: '100%' },
  coverPhoto: { position: 'absolute', top: 0, bottom: 0, end: 0, width: '100%' },
  skyline: { marginHorizontal: -GUTTER, marginBottom: -spacing.xl, marginTop: spacing.sm, aspectRatio: 1200 / 262 },
  photoTitle: { fontFamily: fonts.serifSemi, fontSize: 17, lineHeight: 21, color: white },
  photoSub: { fontSize: 12, lineHeight: 16, color: '#E3ECEA', marginTop: 2 },
  flex: { flex: 1 },
  row: { flex: 1, minHeight: 62, borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 10, paddingStart: 14, paddingEnd: 10, paddingVertical: 10 },
  rowTitle: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 18 },
  soon: { position: 'absolute', top: 5, end: 8, fontFamily: fonts.bodySemi, fontSize: 9.5, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill, overflow: 'hidden' },
  chevron: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(220, 240, 236, 0.14)' },
  chevronGold: { backgroundColor: GOLD },
});
