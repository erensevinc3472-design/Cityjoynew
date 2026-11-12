import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { Photo } from '@cityjoy/shared';

import { useResolvedScheme, useThemeColors } from '@/theme/use-theme';
import { ThumbImage } from './thumb-image';

/**
 * Sayfanın tepesinde il fotoğrafı (Eren'in tasarım örnekleri, 8 Kasım 2026). 12 Kasım: Benim Şehrim alt sayfalarından kaldırıldı (Eren: "en tepede arka planda resme gerek yok"); yalnızca Seyahat sayfalarında kalır: üstte başlık okunsun diye koyulaşır,
 * altta sayfa zeminine erir. Dokunmaları engellemez.
 */
export function CoverBackdrop({ photo, height }: { photo: Pick<Photo, 'url' | 'path'>; height: number }) {
  const c = useThemeColors();
  const dark = useResolvedScheme() === 'dark';
  const id = 'cover' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const shade = '#06191C';
  return (
    <View pointerEvents="none" style={[styles.wrap, { height }]}>
      <ThumbImage photo={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessible={false} accessibilityIgnoresInvertColors />
      <Svg width="100%" height="100%" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={shade} stopOpacity={0.5} />
            <Stop offset="0.3" stopColor={shade} stopOpacity={0.08} />
            <Stop offset="0.55" stopColor={shade} stopOpacity={dark ? 0.12 : 0.16} />
            <Stop offset="0.8" stopColor={c.background} stopOpacity={dark ? 0.55 : 0.5} />
            <Stop offset="1" stopColor={c.background} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  // Fotoğraf yüklenene kadar koyu zemin (açık modda gri bant görünmesin).
  wrap: { position: 'absolute', top: 0, start: 0, end: 0, overflow: 'hidden', backgroundColor: '#0A2226' },
});
