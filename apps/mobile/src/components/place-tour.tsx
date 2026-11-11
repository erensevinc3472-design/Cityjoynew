import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, I18nManager, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TourPoint, TourScene } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { fonts, GUTTER, radius, spacing } from '@/theme/tokens';
import { useResolvedScheme, useThemeColors } from '@/theme/use-theme';

const STAGE = '#0B2328';
const GOLD = '#E2B277';
const CREAM = '#F4ECDC';
const INK = '#0B2328';
const SPEECH_LANG: Record<string, string> = { tr: 'tr-TR', en: 'en-US', de: 'de-DE', ar: 'ar-SA', ru: 'ru-RU' };

/**
 * "İçini gez" (Eren, 11 Kasım 2026): yerin maket görünümlü resimleri arasında sinematik kamera geçişi. İleri giderken
 * eski resim kameraya doğru büyüyüp kaybolur, yenisi biraz yakından gelip yerine oturur (geri giderken tersi). Resmin
 * üstündeki numaralı noktaya dokununca altta "Neye bakmalı?" / "Neden önemli?" kartı açılır; "Sesli dinle" yazıyı
 * telefonun kendi sesiyle okur (ücretsiz). Hareket azaltma açıksa yalnızca yumuşak geçiş yapılır.
 */
export function PlaceTour({ tour }: { tour: TourScene[] }) {
  const { t, i18n } = useTranslation();
  const c = useThemeColors();
  const dark = useResolvedScheme() === 'dark';
  const { width, height } = useWindowDimensions();
  const [scene, setScene] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const [point, setPoint] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [reduce, setReduce] = useState(false);
  const progress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    return () => void Speech.stop();
  }, []);

  const stageH = Math.round(Math.min((width * 4) / 3, height * 0.6, 640));
  const current = tour[Math.min(scene, tour.length - 1)];
  const sel: TourPoint | undefined = point !== null ? current.points[point] : undefined;

  const box = (s: TourScene) => {
    const aspect = s.image.width > 0 && s.image.height > 0 ? s.image.width / s.image.height : 3 / 4;
    const w = Math.min(width, stageH * aspect);
    return { width: w, height: w / aspect };
  };

  const stopSpeech = () => {
    Speech.stop();
    setSpeaking(false);
  };

  const go = (next: number, pointAfter: number | null = null) => {
    stopSpeech();
    if (next === scene) return setPoint(pointAfter);
    setDir(next > scene ? 1 : -1);
    setPrev(scene);
    setScene(next);
    setPoint(pointAfter);
    progress.setValue(0);
  };

  // Geçiş, iki katman ekrana çizildikten sonra başlar (aksi hâlde web'de yeni katmanlar hareketi kaçırıyor).
  useEffect(() => {
    if (prev === null) return;
    const a = Animated.timing(progress, { toValue: 1, duration: reduce ? 350 : 1100, easing: Easing.bezier(0.45, 0, 0.2, 1), useNativeDriver: Platform.OS !== 'web' });
    a.start(({ finished }) => finished && setPrev(null));
    return () => a.stop();
  }, [scene, prev, reduce, progress]);

  const nextDetail = () => {
    stopSpeech();
    if (point !== null && point < current.points.length - 1) return setPoint(point + 1);
    // Sahnenin son noktasından sonra noktası olan bir sonraki sahneye geçilir.
    for (let k = 1; k <= tour.length; k++) {
      const n = (scene + k) % tour.length;
      if (tour[n].points.length) return go(n, 0);
    }
  };

  const speak = () => {
    if (!sel) return;
    if (speaking) return stopSpeech();
    const text = [sel.title, sel.look && `${t('travel.tour.look')} ${sel.look}`, sel.why && `${t('travel.tour.why')} ${sel.why}`].filter(Boolean).join('. ');
    setSpeaking(true);
    Speech.speak(text, {
      language: SPEECH_LANG[i18n.language.slice(0, 2)] ?? 'tr-TR',
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  // Kamera hareketi: ileri giderken eski resim büyüyüp kaybolur, yenisi yakından gelip oturur.
  const outScale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, reduce ? 1 : dir === 1 ? 1.45 : 0.82] });
  const outOpacity = progress.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 0, 0] });
  const inScale = progress.interpolate({ inputRange: [0, 1], outputRange: [reduce ? 1 : dir === 1 ? 1.18 : 0.9, 1] });
  const inOpacity = progress.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0.6, 1] });
  const pointsOpacity = progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0, 0, 1] });

  const layer = (s: TourScene, idx: number, style: object, withPoints: boolean) => {
    const b = box(s);
    return (
      <Animated.View key={`${idx}-${s.image.path}`} pointerEvents={withPoints ? 'box-none' : 'none'} style={[StyleSheet.absoluteFill, styles.center, style]}>
        <View style={{ width: b.width, height: b.height }}>
          <Image source={{ uri: s.image.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} accessibilityIgnoresInvertColors accessible={false} />
          {withPoints ? (
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: pointsOpacity }]} pointerEvents="box-none">
              {s.points.map((p, j) => {
                const on = j === point;
                return (
                  <Pressable
                    key={j}
                    accessibilityRole="button"
                    accessibilityLabel={`${j + 1}. ${p.title}`}
                    accessibilityState={{ selected: on }}
                    hitSlop={10}
                    onPress={() => (stopSpeech(), setPoint(on ? null : j))}
                    style={[styles.dot, { left: p.x * b.width - 16, top: p.y * b.height - 16 }, on ? styles.dotOn : styles.dotOff]}>
                    <AppText style={[styles.dotText, { color: on ? INK : '#FFFFFF' }]}>{j + 1}</AppText>
                  </Pressable>
                );
              })}
            </Animated.View>
          ) : null}
        </View>
      </Animated.View>
    );
  };

  return (
    <View>
      {/* Sahneler */}
      {tour.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="tablist">
          {tour.map((s, i) => {
            const on = i === scene;
            return (
              <Pressable
                key={i}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => go(i)}
                style={[styles.chip, on ? { backgroundColor: GOLD, borderColor: GOLD } : { borderColor: c.border, backgroundColor: dark ? 'rgba(255,255,255,0.04)' : c.surface }]}>
                <AppText style={[styles.chipText, { color: on ? INK : c.textStrong }]}>{s.label}</AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {/* Sahne */}
      <View style={[styles.stage, { height: stageH }]}>
        {prev !== null && tour[prev] ? layer(tour[prev], prev, { opacity: outOpacity, transform: [{ scale: outScale }] }, false) : null}
        {layer(current, scene, prev !== null ? { opacity: inOpacity, transform: [{ scale: inScale }] } : {}, true)}
        <AppText style={styles.note}>{t('travel.tour.illustrative')}</AppText>
      </View>

      {/* Ayrıntı kartı */}
      <View style={styles.pad}>
        {sel ? (
          <View style={[styles.sheet, !dark && { borderWidth: 1, borderColor: c.border }]}>
            <View style={styles.sheetHead}>
              <View style={styles.sheetNum}>
                <AppText style={styles.sheetNumText}>{(point ?? 0) + 1}</AppText>
              </View>
              <AppText accessibilityRole="header" style={styles.sheetTitle}>{sel.title}</AppText>
              <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={10} onPress={() => (stopSpeech(), setPoint(null))} style={styles.close}>
                <MaterialIcons name="close" size={22} color={INK} />
              </Pressable>
            </View>
            {sel.look ? (
              <View style={styles.row}>
                <AppText style={styles.rowLabel}>{t('travel.tour.look')}</AppText>
                <AppText style={styles.rowText}>{sel.look}</AppText>
              </View>
            ) : null}
            {sel.look && sel.why ? <View style={styles.rule} /> : null}
            {sel.why ? (
              <View style={styles.row}>
                <AppText style={styles.rowLabel}>{t('travel.tour.why')}</AppText>
                <AppText style={styles.rowText}>{sel.why}</AppText>
              </View>
            ) : null}
            <View style={styles.sheetActions}>
              <Pressable accessibilityRole="button" onPress={speak} style={({ pressed }) => [styles.listen, { opacity: pressed ? 0.8 : 1 }]}>
                <MaterialIcons name={speaking ? 'stop' : 'headphones'} size={18} color={INK} />
                <AppText style={styles.listenText}>{speaking ? t('travel.tour.stop') : t('travel.tour.listen')}</AppText>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={nextDetail} hitSlop={8} style={({ pressed }) => [styles.next, { opacity: pressed ? 0.7 : 1 }]}>
                <AppText style={styles.nextText}>{t('travel.tour.next')}</AppText>
                <MaterialIcons name={I18nManager.isRTL ? 'arrow-back' : 'arrow-forward'} size={18} color="#9A6A2E" />
              </Pressable>
            </View>
          </View>
        ) : current.points.length ? (
          <View style={styles.hint}>
            <MaterialIcons name="touch-app" size={18} color={c.accent} />
            <AppText style={[styles.hintText, { color: c.textMuted }]}>{t('travel.tour.hint')}</AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  chips: { paddingHorizontal: GUTTER, paddingVertical: spacing.sm, gap: spacing.sm },
  chip: { minHeight: 38, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 13 },
  stage: { backgroundColor: STAGE, overflow: 'hidden' },
  note: { position: 'absolute', bottom: 8, end: 10, fontSize: 10, color: 'rgba(255,255,255,0.55)', fontFamily: fonts.bodyMedium },
  dot: { position: 'absolute', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  dotOff: { backgroundColor: 'rgba(11,35,40,0.78)', borderColor: GOLD },
  dotOn: { backgroundColor: GOLD, borderColor: '#FFFFFF', transform: [{ scale: 1.15 }] },
  dotText: { fontFamily: fonts.heading, fontSize: 14 },
  pad: { paddingHorizontal: GUTTER, paddingTop: spacing.md, width: '100%', maxWidth: 640, alignSelf: 'center' },
  sheet: { backgroundColor: CREAM, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sheetNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  sheetNumText: { fontFamily: fonts.heading, fontSize: 13, color: INK },
  sheetTitle: { flex: 1, fontFamily: fonts.serifSemi, fontSize: 24, lineHeight: 30, color: INK },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  row: { gap: 2 },
  rowLabel: { fontFamily: fonts.heading, fontSize: 13, color: INK },
  rowText: { fontSize: 14, lineHeight: 21, color: '#2A3B3F' },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(11,35,40,0.2)' },
  sheetActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  listen: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 42, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1.5, borderColor: INK },
  listenText: { fontFamily: fonts.bodySemi, fontSize: 14, color: INK },
  next: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 42 },
  nextText: { fontFamily: fonts.bodySemi, fontSize: 14, color: '#9A6A2E' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  hintText: { fontSize: 13 },
});
