import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Animated, I18nManager, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { TR_REGIONS, videoEmbedUrl, type TravelCityContent } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { CoverArt, sceneSky } from '@/components/scene-art';
import { StateMessage } from '@/components/state-message';
import { TravelHeader } from '@/components/travel-header';
import { VideoModal } from '@/components/video-modal';
import { locationRepository as repo } from '@/lib/locations';
import { CATEGORY_SCENES, REGION_SCENES, useTravelCities, useTravelRegions } from '@/lib/travel';
import { trAccusative } from '@/lib/tr-grammar';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useResolvedScheme, useThemeColors } from '@/theme/use-theme';

const GAP = 14;

/**
 * Bölge sayfası: şehir seçimi (Eren'in örneği, 11 Kasım 2026: docs/tasarim-ornekleri/seyahat-sehir-secimi.png).
 * Üstte bölgenin fotoğraflı kapağı ve tanıtım videosu; altında bölgenin bütün illeri yatay kaydırılan büyük fotoğraf
 * kartları olarak. Tanıtımı yayında olmayan il "Yakında" etiketiyle görünür, düğmesi kapalıdır. Alttaki il adları
 * şeridi kartlarla birlikte kayar; ada dokununca o karta gidilir. Kart boyu ekran yüksekliğine göre ayarlanır.
 */
export default function TravelRegionScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const dark = useResolvedScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const def = TR_REGIONS.find((r) => r.id === id);
  const { value: regions } = useTravelRegions();
  const { value: cities, failed, retry } = useTravelCities(id);
  const [playing, setPlaying] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const listRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const namesRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const nameLayouts = useRef<Record<number, { x: number; width: number }>>({});
  const content = regions?.find((r) => r.id === id);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/travel/explore'));
  const codes = def?.provinceCodes ?? [];

  // Alttaki ad şeridi, seçili ili ortada tutacak biçimde kayar.
  useEffect(() => {
    const l = nameLayouts.current[index];
    if (l) namesRef.current?.scrollTo({ x: Math.max(0, l.x - (width - l.width) / 2), animated: true });
  }, [index, width]);

  if (!def) {
    return (
      <View style={[styles.root, { backgroundColor: c.background }]}>
        <TravelHeader subtitle={t('travel.route')} onBack={back} />
        <StateMessage kind="empty" message={t('travel.notFound')} />
      </View>
    );
  }

  const lang = i18n.language;
  const rtl = I18nManager.isRTL;
  const name = t(`travel.regions.${def.id}`);
  const scene = REGION_SCENES[def.id];
  const live = new Map<string, TravelCityContent>((cities ?? []).filter((x) => codes.includes(x.id)).map((x) => [x.id, x]));
  const nameOf = (code: string) => repo.getProvince(code)?.name ?? code;

  // Yerleşim: kapak, başlık, kart, gezinme, düğme ve ad şeridi ekrana sığsın; kart kalan yüksekliği alır.
  const heroH = Math.round(Math.min(310, Math.max(200, height * 0.31)));
  const fixed = heroH + 36 + 48 + 56 + 50 + insets.bottom + spacing.md * 3;
  const cardH = Math.round(Math.min(480, Math.max(220, height - fixed)));
  const cardW = Math.round(Math.min(cardH * 0.8, width * 0.68, 400));
  const step = cardW + GAP;
  const nameSize = Math.round(Math.min(44, cardW * 0.15));
  const side = (width - cardW) / 2;

  const goTo = (i: number) => {
    const n = Math.max(0, Math.min(codes.length - 1, i));
    setIndex(n);
    listRef.current?.scrollTo({ x: n * step, animated: true });
  };
  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: true,
    listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const n = Math.max(0, Math.min(codes.length - 1, Math.round(e.nativeEvent.contentOffset.x / step)));
      if (n !== index) setIndex(n);
    },
  });
  const open = (code: string) => router.push({ pathname: '/travel/city/[code]', params: { code } });
  const play = (url: string) => {
    const embed = videoEmbedUrl(url);
    if (embed) setPlaying(embed);
    else WebBrowser.openBrowserAsync(url).catch(() => {});
  };

  const current = codes[index];
  const currentLive = current ? live.get(current) : undefined;
  const currentName = current ? nameOf(current) : '';
  const gold = dark ? '#E2B277' : '#94662C';
  const cta = currentLive ? t('travel.exploreCity', { name: lang.startsWith('tr') ? trAccusative(currentName) : currentName }) : t('travel.preparing');

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar style="light" />

      {/* Kapak */}
      <View style={[styles.hero, { height: heroH + insets.top, backgroundColor: sceneSky(scene) }]}>
        <View style={StyleSheet.absoluteFill}>
          <CoverArt photo={content?.cover} kind={scene} />
        </View>
        <Fade color="#06191D" top={0.55} bottom={0} />
        <Fade color={c.background} top={0} bottom={1} start={0.45} />
        <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={back} hitSlop={8} style={styles.backBtn}>
            <MaterialIcons name={rtl ? 'chevron-right' : 'chevron-left'} size={30} color="#FFFFFF" />
          </Pressable>
          <AppText style={styles.brand} numberOfLines={1}>{t('travel.brand').toLocaleUpperCase(lang)}</AppText>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.heroBottom}>
          <AppText accessibilityRole="header" numberOfLines={2} style={[styles.heroTitle, { color: dark ? '#FFFFFF' : c.textStrong }]}>
            {name}
          </AppText>
          <View style={styles.heroRow}>
          <View style={styles.countTag}>
            <MaterialIcons name="location-city" size={12} color="#E2B277" />
            <AppText style={styles.countText}>{t('travel.statCities', { count: codes.length })}</AppText>
          </View>
          {content?.videoUrl ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('travel.video')} onPress={() => play(content.videoUrl!)} style={({ pressed }) => [styles.video, { opacity: pressed ? 0.8 : 1 }]}>
              <View style={[styles.playCircle, { backgroundColor: dark ? 'rgba(255,255,255,0.18)' : 'rgba(14,79,87,0.12)' }]}>
                <MaterialIcons name="play-arrow" size={20} color={dark ? '#FFFFFF' : c.textStrong} />
              </View>
              <AppText style={[styles.videoText, { color: dark ? '#FFFFFF' : c.textStrong }]}>{t('travel.video')}</AppText>
            </Pressable>
          ) : null}
          </View>
        </View>
      </View>

      <AppText style={[styles.pick, { color: gold }]}>{t('travel.pickCity').toLocaleUpperCase(lang)}</AppText>

      {failed && !cities ? <StateMessage kind="error" onRetry={retry} /> : null}

      {/* Şehir kartları */}
      <Animated.ScrollView
        ref={listRef as never}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        disableIntervalMomentum
        scrollEventThrottle={16}
        onScroll={onScroll}
        style={{ flexGrow: 0, height: cardH + 8 }}
        contentContainerStyle={{ paddingHorizontal: side, gap: GAP, alignItems: 'center' }}>
        {codes.map((code, i) => {
          const city = live.get(code);
          const cityName = nameOf(code);
          const range = [(i - 1) * step, i * step, (i + 1) * step];
          const scale = scrollX.interpolate({ inputRange: range, outputRange: [0.84, 1, 0.84], extrapolate: 'clamp' });
          const opacity = scrollX.interpolate({ inputRange: range, outputRange: [0.7, 1, 0.7], extrapolate: 'clamp' });
          const sc = city ? CATEGORY_SCENES[city.categories[0] ?? 'tarih'] : scene;
          return (
            <Animated.View key={code} style={{ width: cardW, height: cardH, transform: [{ scale }], opacity }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={city ? [cityName, city.tagline].filter(Boolean).join('. ') : `${cityName}. ${t('travel.soon')}`}
                accessibilityState={{ disabled: !city, selected: i === index }}
                onPress={() => (i !== index ? goTo(i) : city ? open(code) : undefined)}
                style={[styles.card, { backgroundColor: sceneSky(sc) }]}>
                <CoverArt photo={city?.cover} kind={sc} />
                <Fade color="#06191D" top={0} bottom={0.92} start={0.45} />
                {!city ? (
                  <View style={styles.soonTag}>
                    <AppText style={styles.soonText}>{t('travel.soon').toLocaleUpperCase(lang)}</AppText>
                  </View>
                ) : null}
                <View style={styles.cardText}>
                  <AppText numberOfLines={1} adjustsFontSizeToFit style={[styles.cardName, { fontSize: nameSize, lineHeight: Math.round(nameSize * 1.25) }]}>{cityName}</AppText>
                  {city?.tagline ? (
                    <AppText numberOfLines={2} style={styles.cardTag}>{city.tagline.toLocaleUpperCase(lang)}</AppText>
                  ) : null}
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </Animated.ScrollView>

      {/* Gezinme */}
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('travel.prevCity')} disabled={index === 0} onPress={() => goTo(index - 1)} style={[styles.navBtn, { opacity: index === 0 ? 0.3 : 1 }]}>
          <MaterialIcons name={rtl ? 'chevron-right' : 'chevron-left'} size={28} color={c.textStrong} />
        </Pressable>
        <AppText accessibilityLiveRegion="polite" style={[styles.counter, { color: c.textStrong }]}>
          {`${String(index + 1).padStart(2, '0')} / ${String(codes.length).padStart(2, '0')}`}
        </AppText>
        <Pressable accessibilityRole="button" accessibilityLabel={t('travel.nextCity')} disabled={index >= codes.length - 1} onPress={() => goTo(index + 1)} style={[styles.navBtn, { opacity: index >= codes.length - 1 ? 0.3 : 1 }]}>
          <MaterialIcons name={rtl ? 'chevron-left' : 'chevron-right'} size={28} color={c.textStrong} />
        </Pressable>
      </View>

      {/* Keşfet düğmesi */}
      <View style={styles.ctaWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !currentLive }}
          disabled={!currentLive}
          onPress={() => current && open(current)}
          style={({ pressed }) => [
            styles.cta,
            currentLive
              ? { backgroundColor: dark ? '#F4ECDC' : c.primary, opacity: pressed ? 0.88 : 1 }
              : { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.border },
          ]}>
          <AppText numberOfLines={1} style={[styles.ctaText, { color: currentLive ? (dark ? '#0B2328' : c.onPrimary) : c.textMuted }]}>{cta}</AppText>
          {currentLive ? <MaterialIcons name={rtl ? 'arrow-back' : 'arrow-forward'} size={22} color={dark ? '#0B2328' : c.onPrimary} style={styles.ctaArrow} /> : null}
        </Pressable>
      </View>

      {/* İl adları şeridi */}
      <ScrollView
        ref={namesRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.names}
        contentContainerStyle={[styles.namesContent, { paddingBottom: insets.bottom + 4 }]}
        accessibilityRole="tablist">
        {codes.map((code, i) => {
          const selected = i === index;
          return (
            <Pressable
              key={code}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => goTo(i)}
              onLayout={(e: LayoutChangeEvent) => (nameLayouts.current[i] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width })}
              style={styles.nameBtn}>
              <AppText style={[styles.nameText, selected ? { color: gold, fontFamily: fonts.heading } : { color: c.textMuted }]}>{nameOf(code)}</AppText>
              <View style={[styles.underline, { backgroundColor: selected ? gold : 'transparent' }]} />
            </Pressable>
          );
        })}
      </ScrollView>

      <VideoModal src={playing} title={`${name} · ${t('travel.video')}`} onClose={() => setPlaying(null)} />
    </View>
  );
}

/** Dikey geçiş: `start` noktasından sonra `top` → `bottom` saydamlığa. */
function Fade({ color, top, bottom, start = 0 }: { color: string; top: number; bottom: number; start?: number }) {
  const gid = `fade${color.replace(/[^a-zA-Z0-9]/g, '')}${Math.round(top * 100)}${Math.round(bottom * 100)}${Math.round(start * 100)}`;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={top} />
            <Stop offset={String(start)} stopColor={color} stopOpacity={top} />
            <Stop offset="1" stopColor={color} stopOpacity={bottom} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gid})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  hero: { overflow: 'hidden', justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  brand: { flex: 1, textAlign: 'center', color: '#FFFFFF', fontFamily: fonts.headingSemi, fontSize: 14, letterSpacing: 7 },
  heroBottom: { paddingHorizontal: 20, paddingBottom: spacing.xs, gap: 2 },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  countTag: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: 'rgba(6,25,29,0.55)' },
  countText: { color: '#FFFFFF', fontFamily: fonts.bodySemi, fontSize: 11 },
  heroTitle: { fontFamily: fonts.serifSemi, fontSize: 32, lineHeight: 40 },
  video: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  playCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  videoText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  pick: { textAlign: 'center', fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 5, marginTop: spacing.xs, marginBottom: spacing.sm },
  card: { flex: 1, borderRadius: 26, overflow: 'hidden', justifyContent: 'flex-end' },
  soonTag: { position: 'absolute', top: 14, start: 14, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: 'rgba(6,25,29,0.65)', borderWidth: 1, borderColor: 'rgba(226,178,119,0.6)' },
  soonText: { color: '#E2B277', fontFamily: fonts.bodySemi, fontSize: 10, letterSpacing: 1.5 },
  cardText: { alignItems: 'center', paddingHorizontal: 14, paddingBottom: 22, gap: 4 },
  cardName: { color: '#FFFFFF', fontFamily: fonts.serifSemi, textAlign: 'center' },
  cardTag: { color: '#E2B277', fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 2.5, textAlign: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 56, marginTop: spacing.sm },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  counter: { fontFamily: fonts.bodyMedium, fontSize: 16, letterSpacing: 1.5, minWidth: 70, textAlign: 'center' },
  ctaWrap: { paddingHorizontal: 28, marginTop: spacing.xs, width: '100%', maxWidth: 520, alignSelf: 'center' },
  cta: { minHeight: 54, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 48 },
  ctaText: { fontFamily: fonts.heading, fontSize: 17 },
  ctaArrow: { position: 'absolute', end: 22 },
  names: { flexGrow: 0, marginTop: spacing.md },
  namesContent: { paddingHorizontal: 20, gap: 26 },
  nameBtn: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  nameText: { fontFamily: fonts.bodyMedium, fontSize: 16 },
  underline: { height: 3, width: '80%', borderRadius: 2, marginTop: 6 },
});
