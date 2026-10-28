import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/app-text';
import { RoundButton } from '@/components/hero-header';
import { SceneArt, sceneRim, sceneSky, type SceneKind } from '@/components/scene-art';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { fonts, GUTTER, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];
interface Card {
  key: string;
  icon: IconName;
  scene: SceneKind;
  href?: Href;
}

/**
 * Sosyal Harmoni bölümleri (PROJE.md 5.3). Forum ilk sürümde yok (13. madde 18); kulüpler "Şehir Kulüpleri" (madde 12).
 * Hazır olanlar açılır, diğerleri "yakında".
 */
const SOCIAL: Card[] = [
  { key: 'events', icon: 'event', scene: 'events', href: '/events' },
  { key: 'activities', icon: 'groups', scene: 'activities', href: '/activities' },
  { key: 'news', icon: 'newspaper', scene: 'news', href: '/news' },
  { key: 'contests', icon: 'emoji-events', scene: 'contests' },
  { key: 'polls', icon: 'poll', scene: 'polls' },
  { key: 'clubs', icon: 'sports-soccer', scene: 'clubs' },
];

/**
 * Fırsatlar (ikinci sayfa; tasarımdaki indirim türleri). İndirimler doğrulanmış işletmelerin kampanyalarıyla gelecek
 * (13. madde 13-17: geçerlilik, şartlar, "sponsorlu" işareti); o zamana kadar hepsi "yakında". Örnek oran ve marka yok.
 */
const DEALS: Card[] = [
  { key: 'food', icon: 'restaurant', scene: 'food' },
  { key: 'market', icon: 'shopping-cart', scene: 'market' },
  { key: 'sport', icon: 'fitness-center', scene: 'clubs' },
  { key: 'fun', icon: 'theater-comedy', scene: 'events' },
  { key: 'craft', icon: 'storefront', scene: 'neighbourhood' },
  { key: 'health', icon: 'health-and-safety', scene: 'health' },
  { key: 'education', icon: 'school', scene: 'education' },
];

/**
 * Sosyal Harmoni (tasarım: sosyal-harmoni.html, Eren beğendi; 13. madde 28): iki tam ekran sayfa. Üstte topluluk,
 * yukarı kaydırınca Fırsatlar. Her sayfada yana kaydırılan kartlar; ortadaki kartın sahnesi arkada soluklaşarak değişir,
 * başlık ve açıklama da ona göre değişir.
 */
export default function SocialScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { rtl } = useSettings();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { location } = useUserLocation();
  const province = location ? repo.getProvince(location.provinceCode)?.name : undefined;
  const pager = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState(0);

  // Şehir yalnızca bilgi olarak görünür; konum burada değiştirilmez (bölgesel / genel ayrımı ilgili ekranlarda).
  const cityLine = province ? (
    <View style={styles.city}>
      <MaterialIcons name="place" size={13} color={c.heroAccent} />
      <AppText numberOfLines={1} style={[styles.cityText, { color: c.heroAccent }]}>{province}</AppText>
    </View>
  ) : null;

  const goPage = (p: number) => {
    pager.current?.scrollTo({ y: p * height, animated: true });
    setPage(p);
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar style="light" />
      <ScrollView
        ref={pager}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.y / height))}>
        <View style={{ height }}>
          <Carousel
            cards={SOCIAL}
            textKey={(k) => `social.cards.${k}`}
            nameKey={(k) => `social.sections.${k}`}
            top={
              <View style={styles.bar}>
                <RoundButton icon={rtl ? 'arrow-forward' : 'arrow-back'} label={t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />
                <View style={styles.titleBox}>
                  <AppText accessibilityRole="header" numberOfLines={1} style={styles.title}>{t('modules.social')}</AppText>
                  {cityLine}
                </View>
                <View style={styles.spacer} />
              </View>
            }
            footer={
              <Pressable accessibilityRole="button" accessibilityLabel={t('social.toDeals')} onPress={() => goPage(1)} hitSlop={8} style={({ pressed }) => [styles.hint, { opacity: pressed ? 0.7 : 1 }]}>
                <AppText style={[styles.hintText, { color: c.heroAccent }]}>{t('social.toDeals')}</AppText>
                <MaterialIcons name="keyboard-double-arrow-down" size={22} color={c.heroAccent} />
              </Pressable>
            }
            insetTop={insets.top}
            insetBottom={insets.bottom}
          />
        </View>
        <View style={{ height }}>
          <Carousel
            cards={DEALS}
            textKey={(k) => `social.deals.${k}`}
            nameKey={(k) => `social.deals.${k}.name`}
            top={
              <View style={styles.bar}>
                <RoundButton icon="arrow-upward" label={t('social.backToSocial')} onPress={() => goPage(0)} />
                <View style={styles.titleBox}>
                  <AppText accessibilityRole="header" numberOfLines={1} style={styles.title}>{t('social.sections.deals')}</AppText>
                  {cityLine}
                </View>
                <View style={styles.spacer} />
              </View>
            }
            chip={<AppText style={styles.dealsNote}>{t('social.dealsNote')}</AppText>}
            insetTop={insets.top}
            insetBottom={insets.bottom}
            active={page === 1}
          />
        </View>
      </ScrollView>
    </View>
  );
}

/** Bir sayfa: arka plan sahneleri, üst bant, değişen başlık, yana kaydırılan kartlar, sayfa noktaları. */
function Carousel({
  cards,
  textKey,
  nameKey,
  top,
  chip,
  footer,
  insetTop,
  insetBottom,
  active = true,
}: {
  cards: Card[];
  textKey(k: string): string;
  nameKey(k: string): string;
  top: ReactNode;
  chip?: ReactNode;
  footer?: ReactNode;
  insetTop: number;
  insetBottom: number;
  active?: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const cardW = Math.min(Math.round(width * 0.62), 290);
  const gap = 14;
  const step = cardW + gap;
  const side = (Math.min(width, 640) - cardW) / 2;
  const x = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);
  const current = cards[index];

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { x } } }], {
    useNativeDriver: true,
    listener: (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      const i = Math.max(0, Math.min(cards.length - 1, Math.round(e.nativeEvent.contentOffset.x / step)));
      if (i !== index) setIndex(i);
    },
  });

  return (
    <View style={styles.page} importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}>
      {/* Arkada ortadaki kartın sahnesi; kaydırdıkça bir sonrakine soluklaşarak geçer. */}
      {cards.map((s, i) => (
        <Animated.View
          key={s.key}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: sceneSky(s.scene), opacity: x.interpolate({ inputRange: [(i - 1) * step, i * step, (i + 1) * step], outputRange: [0, 1, 0], extrapolate: 'clamp' }) }]}>
          <View style={[styles.scene, { height: Math.round(width * 1.25) }]}>
            <SceneArt kind={s.scene} still />
          </View>
        </Animated.View>
      ))}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim]} />

      <View style={[styles.top, { paddingTop: insetTop + spacing.sm }]}>
        {top}
        {chip}
        <View style={styles.headline} accessibilityLiveRegion="polite">
          <AppText style={[styles.kicker, { color: c.heroAccent }]}>{t(`${textKey(current.key)}.tag`).toLocaleUpperCase()}</AppText>
          <AppText style={styles.big}>{t(nameKey(current.key))}</AppText>
          <AppText numberOfLines={2} style={styles.desc}>{t(`${textKey(current.key)}.desc`)}</AppText>
        </View>
      </View>

      <Animated.FlatList
        data={cards}
        keyExtractor={(s) => s.key}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: side, gap }}
        style={styles.list}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item: s, index: i }) => {
          const name = t(nameKey(s.key));
          const scale = x.interpolate({ inputRange: [(i - 1) * step, i * step, (i + 1) * step], outputRange: [0.9, 1, 0.9], extrapolate: 'clamp' });
          return (
            <Animated.View style={{ width: cardW, transform: [{ scale }] }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={s.href ? `${name}. ${t(`${textKey(s.key)}.desc`)}` : `${name}. ${t('home.comingSoon')}`}
                disabled={!s.href}
                onPress={s.href ? () => router.push(s.href!) : undefined}
                style={({ pressed }) => [styles.card, { height: Math.round(cardW * 1.25), borderColor: sceneRim(s.scene), opacity: pressed ? 0.9 : 1 }]}>
                <SceneArt kind={s.scene} />
                <View style={styles.cardIcon}>
                  <MaterialIcons name={s.icon} size={20} color="#FFFFFF" />
                </View>
                {!s.href ? <AppText style={[styles.soon, { backgroundColor: c.surfaceStrong, color: c.textMuted }]}>{t('city.soon')}</AppText> : null}
                <View style={styles.cardFoot}>
                  <AppText style={[styles.cardTag, { color: c.heroAccent }]}>{t(`${textKey(s.key)}.tag`)}</AppText>
                  <AppText style={styles.cardTitle}>{name}</AppText>
                  <AppText style={styles.cardHint}>{s.href ? t('social.tapToExplore') : t('home.comingSoon')}</AppText>
                </View>
              </Pressable>
            </Animated.View>
          );
        }}
      />

      <View style={[styles.bottom, { paddingBottom: insetBottom + spacing.md }]}>
        <View style={styles.dots} accessible accessibilityLabel={`${index + 1} / ${cards.length}`}>
          {cards.map((s, i) => (
            <View key={s.key} style={[styles.dot, i === index ? { width: 18, backgroundColor: c.heroAccent } : { backgroundColor: 'rgba(255, 255, 255, 0.3)' }]} />
          ))}
        </View>
        {footer}
      </View>
    </View>
  );
}

const white = '#FFFFFF';
const styles = StyleSheet.create({
  root: { flex: 1 },
  page: { flex: 1 },
  scene: { position: 'absolute', start: 0, end: 0, bottom: 0, overflow: 'hidden' },
  dim: { backgroundColor: 'rgba(8, 26, 30, 0.62)' },
  top: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: GUTTER, gap: spacing.sm },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titleBox: { flex: 1, alignItems: 'center' },
  title: { textAlign: 'center', fontFamily: fonts.heading, fontSize: 17, lineHeight: 22, color: white },
  city: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1 },
  cityText: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 16 },
  spacer: { width: 40 },
  dealsNote: { fontSize: 12, lineHeight: 17, color: '#D5E2E3' },
  headline: { gap: 2, paddingTop: spacing.xs, minHeight: 100 },
  kicker: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 1.2 },
  big: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 32, color: white },
  desc: { fontSize: 14, lineHeight: 20, color: '#D5E2E3' },
  list: { flexGrow: 0, marginTop: spacing.sm },
  card: { borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  cardIcon: {
    position: 'absolute',
    top: 12,
    start: 12,
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 35, 40, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  soon: { position: 'absolute', top: 16, end: 12, fontFamily: fonts.bodySemi, fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden' },
  cardFoot: { position: 'absolute', start: 0, end: 0, bottom: 0, padding: 14, backgroundColor: 'rgba(8, 26, 30, 0.72)' },
  cardTag: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 0.6 },
  cardTitle: { fontFamily: fonts.heading, fontSize: 19, lineHeight: 25, color: white },
  cardHint: { fontSize: 12, color: '#D5E2E3', marginTop: 2 },
  bottom: { marginTop: 'auto', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  hintText: { fontFamily: fonts.bodySemi, fontSize: 13 },
});
