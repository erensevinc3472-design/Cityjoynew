import { MaterialIcons } from '@expo/vector-icons';
import { useId, type ComponentProps, type ReactNode } from 'react';
import { Image } from 'expo-image';
import { I18nManager, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/app-text';
import { frost } from '@/components/city-hub';
import { FrostFill } from '@/components/glass';
import { LineIcon } from '@/components/line-icon';
import { SceneArt, type SceneKind } from '@/components/scene-art';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useResolvedScheme, useThemeColors } from '@/theme/use-theme';

/**
 * Benim Şehrim'in kutuları (Eren'in 7 Kasım 2026 taslağı): fotoğraflı büyük kart, cam satır, altın simgeli başlık.
 * Belediye Hizmetleri, Park & Pazar gibi alt sayfalar da aynı görünümü kullansın diye ortak (Eren, 10 Kasım 2026).
 */
export type IconName = ComponentProps<typeof MaterialIcons>['name'];

export const GOLD = '#E2B277';
export const TEAL = '#4FC2A8';
// Eren'in ChatGPT ile hazırladığı resimler (8 Kasım 2026), her ilde aynı. Kaynakları masaüstündeki CityJoy-gorseller klasöründe.
export const TOWNHALL_ART = require('../../assets/city/belediye.jpg') as number;
export const KURUMLAR_ART = require('../../assets/city/kurumlar.jpg') as number;
export const MAHALLE_ART = require('../../assets/city/mahalle.jpg') as number;
export const VITRIN_ART = require('../../assets/city/vitrin.jpg') as number;

/** Kartın soldan sağa koyulaşan örtüsü (fotoğraf üstündeki yazı okunsun). */
export function Shade({ from, opacity, mid = 0.55, to = 0.15 }: { from: string; opacity: number; mid?: number; to?: number }) {
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

/** Sağdaki küçük yuvarlak ok. `plain`: açık modda beyaz kart üstünde. */
export function Chevron({ gold, plain, open }: { gold?: boolean; plain?: boolean; open?: boolean }) {
  const rtl = I18nManager.isRTL;
  const name = open ? 'expand-less' : rtl ? 'chevron-left' : 'chevron-right';
  return (
    <View style={[styles.chevron, gold ? styles.chevronGold : null, plain ? styles.chevronPlain : null]}>
      <MaterialIcons name={name} size={16} color={gold ? '#2A1C06' : plain ? '#0E5A55' : '#EAF1EF'} />
    </View>
  );
}

/** Fotoğraflı (yoksa çizimli) büyük kart. `gold`: altın tonlu örtü. */
export function PhotoCard({ scene, image, gold, icon, title, sub, flex = 1, height = 100, onPress }: { scene: SceneKind; image?: number; gold?: boolean; icon: IconName; title: string; sub?: string; flex?: number; height?: number; onPress(): void }): ReactNode {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={sub ? `${title}. ${sub}` : title}
      onPress={onPress}
      style={({ pressed }) => [styles.tall, { flex, height, borderColor: gold ? 'rgba(226, 178, 119, 0.55)' : 'rgba(220, 240, 236, 0.18)', transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
      {image ? (
        <View style={styles.cardArt}>
          <Image source={image} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="right" accessible={false} />
        </View>
      ) : (
        <SceneArt kind={scene} still />
      )}
      <Shade from={gold ? '#A87B3E' : '#061417'} opacity={image ? 1 : gold ? 0.95 : 0.88} mid={image ? 0.6 : 0.55} to={image ? 0 : gold ? 0.35 : 0.2} />
      <View>
        <LineIcon name={icon} size={24} color="#FFFFFF" />
      </View>
      <View style={styles.tallFoot}>
        <View style={styles.flex}>
          <AppText numberOfLines={2} style={styles.photoTitle}>{title}</AppText>
          {sub ? <AppText numberOfLines={2} style={styles.photoSub}>{sub}</AppText> : null}
        </View>
        <Chevron gold={gold} />
      </View>
    </Pressable>
  );
}

/** Altın yuvarlak simge, yazı tipi serif başlık ve ince çizgi ("Şehrinde keşfet"). */
export function SectionHeading({ icon = 'explore', title, aside, onAside }: { icon?: IconName; title: string; aside?: string; onAside?(): void }) {
  const c = useThemeColors();
  const dark = useResolvedScheme() === 'dark';
  return (
    <View style={styles.heading}>
      <View style={styles.headingIcon}>
        <LineIcon name={icon} size={15} color="#2A1C06" />
      </View>
      <AppText accessibilityRole="header" style={[styles.headingText, { color: c.textStrong }]} numberOfLines={1}>{title}</AppText>
      <View style={[styles.headingLine, { backgroundColor: c.border }]} />
      {aside ? (
        <Pressable accessibilityRole="button" accessibilityLabel={aside} onPress={onAside} hitSlop={8} style={styles.aside}>
          <AppText style={[styles.asideText, { color: dark ? c.heroAccent : c.primary }]}>{aside}</AppText>
          <MaterialIcons name={I18nManager.isRTL ? 'chevron-left' : 'chevron-right'} size={16} color={dark ? c.heroAccent : c.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Cam satır: simge, ad (altında isteğe bağlı kısa not ya da sayı), ok. `soon`: soluk, "Yakında" etiketli, basılmaz.
 * `trailing`: oktan önce küçük bir ek (ör. sayı rozeti).
 */
export function GlassRow({ icon, tint, title, sub, soon, open, trailing, onPress, flex = 1 }: { icon: IconName; tint?: 'gold' | 'teal' | string; title: string; sub?: string; soon?: boolean; open?: boolean; trailing?: ReactNode; onPress?(): void; flex?: number }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const dark = useResolvedScheme() === 'dark';
  const color = tint === 'gold' ? GOLD : tint === 'teal' ? TEAL : tint ?? c.textStrong;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, sub, soon ? t('city.soon') : undefined].filter(Boolean).join('. ')}
      accessibilityState={{ disabled: !!soon, expanded: open }}
      disabled={soon || !onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, frost(dark, c.surface, c.border), { flex, opacity: soon ? 0.5 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
      <FrostFill />
      <LineIcon name={icon} size={21} color={color} />
      <View style={styles.flex}>
        <AppText numberOfLines={2} style={[styles.rowTitle, { color: c.textStrong }]}>{title}</AppText>
        {sub ? <AppText numberOfLines={2} style={[styles.rowSub, { color: c.textMuted }]}>{sub}</AppText> : null}
      </View>
      {soon ? <AppText style={[styles.soon, { backgroundColor: c.surfaceStrong, color: c.textMuted }]}>{t('city.soon')}</AppText> : null}
      {trailing}
      <Chevron plain={!dark} open={open} />
    </Pressable>
  );
}

const white = '#FFFFFF';
const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.xs },
  headingIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  headingText: { flexShrink: 1, fontFamily: fonts.serif, fontSize: 17, lineHeight: 22 },
  headingLine: { flex: 1, height: 1, marginStart: 6 },
  aside: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  asideText: { fontFamily: fonts.bodySemi, fontSize: 12.5 },
  pair: { flexDirection: 'row', gap: spacing.sm },
  tall: { flex: 1, borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden', padding: spacing.sm + 2, justifyContent: 'space-between', backgroundColor: '#0B2327' },
  tallFoot: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  cardArt: { position: 'absolute', top: 0, bottom: 0, end: 0, width: '100%' },
  photoTitle: { fontFamily: fonts.serifSemi, fontSize: 15, lineHeight: 18, color: white },
  photoSub: { fontSize: 11, lineHeight: 14, color: '#E3ECEA', marginTop: 2 },
  flex: { flex: 1 },
  row: { minHeight: 50, borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 8, paddingStart: 12, paddingEnd: 8, paddingVertical: 8 },
  rowTitle: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 16 },
  rowSub: { fontSize: 11, lineHeight: 14, marginTop: 1 },
  soon: { position: 'absolute', top: 3, end: 6, fontFamily: fonts.bodySemi, fontSize: 9, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill, overflow: 'hidden' },
  chevron: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(220, 240, 236, 0.14)' },
  chevronGold: { backgroundColor: GOLD },
  chevronPlain: { backgroundColor: 'rgba(14, 90, 85, 0.10)' },
});
