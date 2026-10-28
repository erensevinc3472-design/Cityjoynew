import { MaterialIcons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/app-text';
import { SceneArt, sceneSky, useReduceMotion, type SceneKind } from '@/components/scene-art';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { fonts, GUTTER, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/** Sırayla değişen beş görsel (13. madde 27). Fotoğraflar panelden yüklenebilir olunca (Storage) çizimlerin yerini alacak. */
const SLIDES: SceneKind[] = ['cover', 'travel', 'events', 'activities', 'social'];
const SLIDE_MS = 4500;
const HANDLE = 52;

/**
 * Karşılama (tasarım: index.html, Eren beğendi; 13. madde 27): arkada beş görsel yumuşak geçişle değişir, altta
 * "Kaydırarak başla" tutamacı. Tutamaca dokunmak da başlatır (erişilebilirlik); "hareketi azalt" açıksa görsel sabit.
 */
export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { rtl } = useSettings();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduce = useReduceMotion();
  const { user } = useSession();
  const [slide, setSlide] = useState(0);
  const fades = useRef(SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;
  const drag = useRef(new Animated.Value(0)).current;
  const [trackW, setTrackW] = useState(0);
  const max = Math.max(0, trackW - HANDLE - 8);
  const maxRef = useRef(0);
  maxRef.current = max;

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), SLIDE_MS);
    return () => clearInterval(id);
  }, [reduce]);

  useEffect(() => {
    Animated.parallel(fades.map((v, i) => Animated.timing(v, { toValue: i === slide ? 1 : 0, duration: 1200, useNativeDriver: true }))).start();
  }, [slide, fades]);

  const start = () => router.push('/sign-up');
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4,
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, Math.min(maxRef.current, rtl ? -g.dx : g.dx))),
      onPanResponderRelease: (_, g) => {
        const d = rtl ? -g.dx : g.dx;
        if (d > maxRef.current * 0.7) {
          Animated.timing(drag, { toValue: maxRef.current, duration: 120, useNativeDriver: true }).start(() => {
            start();
            drag.setValue(0);
          });
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  // Giriş yapmış kullanıcı karşılama ekranında kalmaz.
  if (user) return <Redirect href="/" />;

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar style="light" />
      {SLIDES.map((k, i) => (
        <Animated.View key={k} pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: fades[i], backgroundColor: sceneSky(k) }]}>
          {/* Uzun ekranda çizim aşırı büyümesin: alt kısma, ekran genişliğine göre yerleşir. */}
          <View style={[styles.scene, { height: Math.round(width * 1.25) }]}>
            <SceneArt kind={k} />
          </View>
        </Animated.View>
      ))}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim]} />

      <View style={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.brand}>
          <AppText accessibilityRole="header" style={styles.logo}>
            City<AppText style={[styles.logo, { color: c.heroAccent }]}>Joy</AppText>
          </AppText>
          <AppText style={styles.title}>{t('auth.welcomeTitle')}</AppText>
          <AppText style={styles.subtitle}>{t('auth.welcomeSubtitle')}</AppText>
        </View>

        <View style={styles.bottom}>
          <View style={styles.bars} accessible accessibilityLabel={`${slide + 1} / ${SLIDES.length}`}>
            {SLIDES.map((k, i) => (
              <View key={k} style={[styles.bar, { backgroundColor: i === slide ? c.heroAccent : 'rgba(255, 255, 255, 0.25)', flex: i === slide ? 2 : 1 }]} />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('auth.slideToStart')}
            accessibilityHint={t('auth.slideToStartHint')}
            onPress={start}
            onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
            style={styles.track}>
            <AppText style={styles.trackText}>{t('auth.slideToStart')}</AppText>
            <Animated.View
              {...pan.panHandlers}
              style={[styles.handle, { backgroundColor: c.heroAccent, [rtl ? 'right' : 'left']: 4, transform: [{ translateX: rtl ? Animated.multiply(drag, -1) : drag }] }]}>
              <MaterialIcons name={rtl ? 'arrow-back' : 'arrow-forward'} size={24} color="#1A1408" />
            </Animated.View>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/sign-in')} hitSlop={8} style={styles.signIn}>
            <AppText style={[styles.signInText, { color: c.heroAccent }]}>{t('auth.haveAccount')}</AppText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const white = '#FFFFFF';
const styles = StyleSheet.create({
  root: { flex: 1 },
  scene: { position: 'absolute', start: 0, end: 0, bottom: 0, overflow: 'hidden' },
  dim: { backgroundColor: 'rgba(8, 26, 30, 0.5)' },
  content: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: GUTTER + 8, justifyContent: 'space-between' },
  brand: { gap: spacing.sm, paddingTop: spacing.xl },
  logo: { fontFamily: fonts.heading, fontSize: 44, lineHeight: 52, color: white, letterSpacing: -0.5 },
  title: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 28, color: white },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#D5E2E3' },
  bottom: { gap: spacing.md },
  bars: { flexDirection: 'row', gap: 6 },
  bar: { height: 4, borderRadius: 2 },
  track: { height: HANDLE + 8, borderRadius: radius.pill, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.18)', justifyContent: 'center' },
  trackText: { textAlign: 'center', fontFamily: fonts.bodySemi, fontSize: 15, color: white, letterSpacing: 0.3 },
  handle: { position: 'absolute', top: 4, width: HANDLE, height: HANDLE, borderRadius: HANDLE / 2, alignItems: 'center', justifyContent: 'center' },
  signIn: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
  signInText: { fontFamily: fonts.bodySemi, fontSize: 14, textAlign: 'center' },
});
