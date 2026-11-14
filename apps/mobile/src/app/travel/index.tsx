import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/app-text';
import { RoundButton } from '@/components/hero-header';
import { sceneSky } from '@/components/scene-art';
import { useArt } from '@/lib/app-art';
import { locationRepository as repo } from '@/lib/locations';
import { useUserLocation } from '@/lib/user-location';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

const GOLD = '#D9A066';
const TEAL = '#25C6CF';

/**
 * Seyahat girişi (tasarım: seyahat.html, Eren beğendi): ekran çaprazlamasına ikiye bölünür. Sol üst "Keşfet ve Öğren",
 * sağ alt "Planla ve Navigasyon" (yakında). Bölünme, döndürülmüş bir kesme kutusuyla yapılır (ek paket gerekmez).
 */
export default function TravelIntroScreen() {
  const { t } = useTranslation();
  const art = useArt();
  const journey = art('travelJourney');
  const explore = art('travelExplore');
  const router = useRouter();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const { location } = useUserLocation();
  const cityCode = location?.provinceCode;
  const cityName = cityCode ? repo.getProvince(cityCode)?.name : undefined;
  const diag = Math.sqrt(W * W + H * H);
  const angle = Math.atan2(H, W);
  const S = diag * 2;
  // Yazı blokları köşegenin iki yanında, ekran dışına taşmadan.
  const at = (x: number) => Math.min(Math.max(spacing.md, x - 110), W - 220 - spacing.md);

  return (
    <View style={[styles.root, { backgroundColor: sceneSky('city') }]}>
      <StatusBar style="light" />
      {/* Alt yarı: tüm ekran; üst yarı onun üstüne çapraz kesilerek konur. */}
      <View style={StyleSheet.absoluteFill}>
        <Image source={journey?.source} onError={journey?.onError} contentFit="cover" style={StyleSheet.absoluteFill} accessible={false} />
        <View style={[StyleSheet.absoluteFill, styles.dim]} />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: S,
          height: S,
          left: W / 2 - S / 2,
          top: H / 2 - S,
          overflow: 'hidden',
          transformOrigin: '50% 100%',
          transform: [{ rotate: `${-angle}rad` }],
        }}>
        <View style={{ position: 'absolute', width: W, height: H, left: S / 2 - W / 2, top: S - H / 2, transform: [{ rotate: `${angle}rad` }], backgroundColor: sceneSky('travel') }}>
          <Image source={explore?.source} onError={explore?.onError} contentFit="cover" style={StyleSheet.absoluteFill} accessible={false} />
          <View style={[StyleSheet.absoluteFill, styles.dim]} />
        </View>
      </View>
      {/* Altın çapraz çizgi. */}
      <View pointerEvents="none" style={{ position: 'absolute', width: diag, height: 2, left: W / 2 - diag / 2, top: H / 2 - 1, backgroundColor: GOLD, transform: [{ rotate: `${-angle}rad` }] }} />

      <View style={[styles.header, { top: insets.top + spacing.sm }]}>
        <RoundButton icon="arrow-back" label={t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />
        <View style={styles.brand}>
          <MaterialIcons name="flight-takeoff" size={18} color={TEAL} />
          <AppText style={styles.brandText}>{t('travel.brand')}</AppText>
        </View>
        <View style={styles.spacer} />
      </View>

      {/* Sol üst: Keşfet ve Öğren. */}
      <View style={[styles.block, { left: at(W * 0.3), top: H * 0.27 - 110 }]}>
        <MaterialIcons name="explore" size={24} color={GOLD} />
        <AppText style={styles.kicker}>{t('travel.intro.curiosity')}</AppText>
        <AppText accessibilityRole="header" style={styles.title}>{t('travel.intro.curiosityTitle')}</AppText>
        <AppText style={styles.text}>{t('travel.intro.curiosityText')}</AppText>
        <Pressable accessibilityRole="button" onPress={() => router.push('/travel/explore')} style={({ pressed }) => [styles.primary, { opacity: pressed ? 0.85 : 1 }]}>
          <AppText style={styles.primaryText}>{t('travel.intro.explore')}</AppText>
        </Pressable>
        {/* Bulunduğu şehir: doğrudan o ilin sayfası, Yoldayım rengiyle (Eren, 12 Kasım 2026). */}
        {cityCode && cityName ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('travel.intro.myCityA11y', { city: cityName })}
            onPress={() => router.push({ pathname: '/travel/city/[code]', params: { code: cityCode } })}
            style={({ pressed }) => [styles.road, styles.city, { opacity: pressed ? 0.85 : 1 }]}>
            <MaterialIcons name="location-on" size={18} color="#1A1408" />
            <AppText style={styles.roadText} numberOfLines={1}>{cityName}</AppText>
          </Pressable>
        ) : null}
      </View>

      {/* Sağ alt: Planla ve Navigasyon (yakında). */}
      <View style={[styles.block, { left: at(W * 0.7), top: H * 0.72 - 110 }]}>
        <MaterialIcons name="near-me" size={24} color={GOLD} />
        <AppText style={styles.kicker}>{t('travel.intro.efficiency')}</AppText>
        <AppText accessibilityRole="header" style={styles.title}>{t('travel.intro.efficiencyTitle')}</AppText>
        <AppText style={styles.text}>{t('travel.intro.efficiencyText')}</AppText>
        {/* Yoldayım (Yol Arkadaşı) hazır; planlayıcı sonra gelecek. */}
        <Pressable accessibilityRole="button" onPress={() => router.push('/travel/yoldayim')} style={({ pressed }) => [styles.road, { opacity: pressed ? 0.85 : 1 }]}>
          <MaterialIcons name="directions-car" size={18} color="#1A1408" />
          <AppText style={styles.roadText}>{t('trip.title')}</AppText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/travel/planla')} style={({ pressed }) => [styles.plan, { opacity: pressed ? 0.85 : 1 }]}>
          <MaterialIcons name="map" size={18} color="#0B2E34" />
          <AppText style={styles.primaryText}>{t('plan.title')}</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const white = '#FFFFFF';
const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  dim: { backgroundColor: 'rgba(11, 46, 52, 0.38)' },
  header: { position: 'absolute', left: spacing.lg, right: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  brandText: { color: white, fontFamily: fonts.heading, fontSize: 16, letterSpacing: 0.5 },
  spacer: { width: 40 },
  block: { position: 'absolute', width: 220, alignItems: 'center', gap: spacing.sm },
  kicker: { color: GOLD, fontFamily: fonts.bodySemi, fontSize: 10, letterSpacing: 2 },
  title: { color: white, fontFamily: fonts.display, fontSize: 26, lineHeight: 31, textAlign: 'center' },
  text: { color: 'rgba(255,255,255,0.9)', fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 200 },
  primary: { marginTop: spacing.xs, backgroundColor: TEAL, paddingVertical: 12, paddingHorizontal: 40, borderRadius: radius.pill, minHeight: 44, justifyContent: 'center' },
  primaryText: { color: '#0B2E34', fontFamily: fonts.heading, fontSize: 15 },
  road: { marginTop: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: GOLD, paddingVertical: 12, paddingHorizontal: 32, borderRadius: radius.pill, minHeight: 44 },
  roadText: { color: '#1A1408', fontFamily: fonts.heading, fontSize: 15 },
  city: { marginTop: 0, maxWidth: 220 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: TEAL, paddingVertical: 12, paddingHorizontal: 24, borderRadius: radius.pill, minHeight: 44 },
  secondary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10, paddingHorizontal: 22, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.05)', minHeight: 44 },
  secondaryText: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.bodySemi, fontSize: 14 },
  soon: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  soonText: { color: '#1A1408', fontFamily: fonts.bodySemi, fontSize: 10 },
});
