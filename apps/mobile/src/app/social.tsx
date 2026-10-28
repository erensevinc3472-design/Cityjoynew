import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState, type ComponentProps } from 'react';
import { Animated, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/app-text';
import { LocationChip, RoundButton } from '@/components/hero-header';
import { SceneArt, sceneRim, type SceneKind } from '@/components/scene-art';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { fonts, GUTTER, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * Sosyal Harmoni bölümleri (PROJE.md 5.3). Forum ilk sürümde yok (13. madde 18); kulüpler "Şehir Kulüpleri" (madde 12).
 * Hazır olanlar açılır, diğerleri "yakında".
 */
const SECTIONS: { key: string; icon: IconName; scene: SceneKind; href?: Href }[] = [
  { key: 'events', icon: 'event', scene: 'events', href: '/events' },
  { key: 'activities', icon: 'groups', scene: 'activities', href: '/activities' },
  { key: 'news', icon: 'newspaper', scene: 'news', href: '/news' },
  { key: 'contests', icon: 'emoji-events', scene: 'contests' },
  { key: 'polls', icon: 'poll', scene: 'polls' },
  { key: 'clubs', icon: 'sports-soccer', scene: 'clubs' },
  { key: 'deals', icon: 'local-offer', scene: 'deals' },
];

/**
 * Sosyal Harmoni (tasarım: sosyal-harmoni.html, Eren beğendi; 13. madde 28): yana kaydırılan büyük kartlar; ortadaki
 * kartın sahnesi arkada soluklaşarak değişir, üstteki başlık ve açıklama da ona göre değişir.
 */
export default function SocialScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { rtl } = useSettings();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { location } = useUserLocation();
  const province = location ? repo.getProvince(location.provinceCode)?.name : undefined;
  const cardW = Math.min(Math.round(width * 0.64), 300);
  const gap = 14;
  const step = cardW + gap;
  const side = (Math.min(width, 640) - cardW) / 2;
  const x = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);
  const current = SECTIONS[index];

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { x } } }], {
    useNativeDriver: true,
    listener: (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      const i = Math.max(0, Math.min(SECTIONS.length - 1, Math.round(e.nativeEvent.contentOffset.x / step)));
      if (i !== index) setIndex(i);
    },
  });

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar style="light" />
      {/* Arkada ortadaki kartın sahnesi; kaydırdıkça bir sonrakine soluklaşarak geçer. */}
      {SECTIONS.map((s, i) => (
        <Animated.View
          key={s.key}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { opacity: x.interpolate({ inputRange: [(i - 1) * step, i * step, (i + 1) * step], outputRange: [0, 1, 0], extrapolate: 'clamp' }) }]}>
          <SceneArt kind={s.scene} still />
        </Animated.View>
      ))}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim]} />

      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.bar}>
          <RoundButton icon={rtl ? 'arrow-forward' : 'arrow-back'} label={t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />
          <AppText accessibilityRole="header" numberOfLines={1} style={styles.title}>{t('modules.social')}</AppText>
          <View style={styles.spacer} />
        </View>
        <LocationChip label={province ?? t('home.noLocation')} onPress={() => router.push('/location?edit=1')} />
        <View style={styles.headline} accessibilityLiveRegion="polite">
          <AppText style={[styles.kicker, { color: c.heroAccent }]}>{t(`social.cards.${current.key}.tag`).toLocaleUpperCase()}</AppText>
          <AppText style={styles.big}>{t(`social.sections.${current.key}`)}</AppText>
          <AppText numberOfLines={2} style={styles.desc}>{t(`social.cards.${current.key}.desc`)}</AppText>
        </View>
      </View>

      <Animated.FlatList
        data={SECTIONS}
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
          const name = t(`social.sections.${s.key}`);
          const scale = x.interpolate({ inputRange: [(i - 1) * step, i * step, (i + 1) * step], outputRange: [0.9, 1, 0.9], extrapolate: 'clamp' });
          return (
            <Animated.View style={{ width: cardW, transform: [{ scale }] }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={s.href ? `${name}. ${t(`social.cards.${s.key}.desc`)}` : `${name}. ${t('home.comingSoon')}`}
                disabled={!s.href}
                onPress={s.href ? () => router.push(s.href!) : undefined}
                style={({ pressed }) => [styles.card, { height: Math.round(cardW * 1.3), borderColor: sceneRim(s.scene), opacity: pressed ? 0.9 : 1 }]}>
                <SceneArt kind={s.scene} />
                <View style={styles.cardIcon}>
                  <MaterialIcons name={s.icon} size={20} color="#FFFFFF" />
                </View>
                {!s.href ? <AppText style={[styles.soon, { backgroundColor: c.surfaceStrong, color: c.textMuted }]}>{t('city.soon')}</AppText> : null}
                <View style={styles.cardFoot}>
                  <AppText style={[styles.cardTag, { color: c.heroAccent }]}>{t(`social.cards.${s.key}.tag`)}</AppText>
                  <AppText style={styles.cardTitle}>{name}</AppText>
                  <AppText style={styles.cardHint}>{s.href ? t('social.tapToExplore') : t('home.comingSoon')}</AppText>
                </View>
              </Pressable>
            </Animated.View>
          );
        }}
      />

      <View style={[styles.dots, { paddingBottom: insets.bottom + spacing.md }]} accessible accessibilityLabel={`${index + 1} / ${SECTIONS.length}`}>
        {SECTIONS.map((s, i) => (
          <View key={s.key} style={[styles.dot, i === index ? { width: 18, backgroundColor: c.heroAccent } : { backgroundColor: 'rgba(255, 255, 255, 0.3)' }]} />
        ))}
      </View>
    </View>
  );
}

const white = '#FFFFFF';
const styles = StyleSheet.create({
  root: { flex: 1 },
  dim: { backgroundColor: 'rgba(8, 26, 30, 0.62)' },
  top: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: GUTTER, gap: spacing.sm },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.heading, fontSize: 17, lineHeight: 24, color: white },
  spacer: { width: 40 },
  headline: { gap: 2, paddingTop: spacing.sm, minHeight: 104 },
  kicker: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 1.2 },
  big: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 34, color: white },
  desc: { fontSize: 14, lineHeight: 20, color: '#D5E2E3' },
  list: { flexGrow: 0, marginTop: spacing.md },
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
  cardTitle: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26, color: white },
  cardHint: { fontSize: 12, color: '#D5E2E3', marginTop: 2 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 'auto', paddingTop: spacing.md },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
