import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CITY_GUIDE_SECTIONS, type CityGuideSectionId } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { GlassRow, GOLD, KURUMLAR_ART, MAHALLE_ART, PhotoCard, SectionHeading, Shade, TOWNHALL_ART, VITRIN_ART, type IconName } from '@/components/city-tiles';
import { PageHead, PAGE_CONTENT } from '@/components/page-head';
import { LineIcon } from '@/components/line-icon';
import { CoverArt } from '@/components/scene-art';
import { Screen } from '@/components/screen';
import { BottomNav } from '@/components/bottom-nav';
import { StateMessage } from '@/components/state-message';
import { useCityGuideMeta } from '@/lib/city-guide';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { useTravelCity } from '@/lib/travel';
import { useUserLocation } from '@/lib/user-location';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useResolvedScheme, useThemeColors } from '@/theme/use-theme';


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
 * yüklenen il kapağı; yoksa çizim), "Şehrinde keşfet" altında Belediye kartı ve Önemli Kurumlar (altın renk kalktı, Eren 12 Kasım 2026), sonra iki
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
    <PageHead
      title={t('modules.myCity')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
      right={{ icon: 'edit-location-alt', label: t('home.changeLocation'), onPress: () => router.push('/location?edit=1') }}
    />
  );

  if (!provinceCode) {
    return (
      <Screen warm bleed>
        <View style={[PAGE_CONTENT, styles.content]}>
          {header}
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
  const renderRow = (tile: Tile) => {
    const { ready, label } = tileState(tile);
    return <GlassRow key={tile.key} icon={tile.icon} tint={tile.tint} title={label} soon={!ready} onPress={() => open(tile)} />;
  };

  const townhall = tileState({ key: 'belediye-hizmetleri', section: 'belediye-hizmetleri', icon: 'apartment' });
  const kurumlar = tileState(KURUMLAR);
  const pairs: Tile[][] = [];
  for (let i = 0; i < TILES.length; i += 2) pairs.push(TILES.slice(i, i + 2));

  return (
    <Screen warm bleed footer={<BottomNav />}>
      <ScrollView contentContainerStyle={[PAGE_CONTENT, styles.content, { paddingBottom: spacing.lg }]} showsVerticalScrollIndicator={false}>
        {header}
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
              <LineIcon name="location-on" size={14} color={GOLD} />
              <AppText numberOfLines={1} style={styles.place}>{[district, neighbourhood].filter(Boolean).join(' · ')}</AppText>
            </View>
            ) : null}
          </View>
          <View pointerEvents="none" style={styles.coverRim} />
        </View>
        {stale ? <AppText variant="caption" muted>{t('city.staleNote')}</AppText> : null}
        {failed && !meta ? <StateMessage kind="error" message={t('city.loadError')} /> : !meta ? <StateMessage kind="loading" /> : null}

        <SectionHeading title={t('city.hub.explore')} />

        <View style={styles.pair}>
          <PhotoCard
            flex={1.2}
            height={84}
            scene="townhall"
            image={TOWNHALL_ART}
            icon="account-balance"
            title={townhall.label}
            onPress={() => router.push('/city/belediyeler')}
          />
          <PhotoCard
            height={84}
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
            icon="auto-awesome"
            title={province ? t('city.hub.showcaseOf', { city: province }) : t('city.showcase')}
            sub={t('showcase.weekly')}
            onPress={() => router.push('/city/showcase')}
          />
        </View>

      </ScrollView>
    </Screen>
  );
}

const white = '#FFFFFF';
const styles = StyleSheet.create({
  content: { gap: spacing.sm },
  cover: { height: 128, borderRadius: radius.xl, borderWidth: 1, borderColor: 'rgba(220, 240, 236, 0.16)', overflow: 'hidden', justifyContent: 'center', backgroundColor: '#0A2226' },
  coverRim: { position: 'absolute', start: 0, end: 0, bottom: 0, height: 2, backgroundColor: GOLD, opacity: 0.7 },
  coverText: { paddingHorizontal: spacing.md, gap: 1, maxWidth: '68%' },
  kicker: { alignSelf: 'flex-start', fontFamily: fonts.bodySemi, fontSize: 10.5, letterSpacing: 1.3, color: GOLD, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: 'rgba(226, 178, 119, 0.6)' },
  cityName: { fontFamily: fonts.serifSemi, fontSize: 30, lineHeight: 36, color: white, marginTop: 2 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  place: { flexShrink: 1, fontSize: 12, color: '#E3ECEA' },
  pair: { flexDirection: 'row', gap: spacing.sm },
  bottom: { marginTop: spacing.sm },
  coverPhoto: { position: 'absolute', top: 0, bottom: 0, end: 0, width: '100%' },
});
