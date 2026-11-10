import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { Photo } from '@cityjoy/shared';

import { useTravelCity } from '@/lib/travel';
import { useUserLocation } from '@/lib/user-location';
import { useResolvedScheme, useThemeColors } from '@/theme/use-theme';
import { ThumbImage } from './thumb-image';

/**
 * Kullanıcının ilinin kapak fotoğrafı (Seyahat panelinde ile yüklenen kapak). Önbellekten gelir; Benim Şehrim ana
 * sayfası zaten okuduğu için alt sayfalarda ek okuma olmaz. Fotoğraf yoksa `undefined`.
 */
export function useProvinceCover(): Pick<Photo, 'url' | 'path'> | undefined {
  const { location } = useUserLocation();
  const { value } = useTravelCity(location?.provinceCode);
  return value?.cover ?? undefined;
}

/**
 * Sayfanın tepesinde il fotoğrafı (Eren'in tasarım örnekleri, 8 Kasım 2026): üstte başlık okunsun diye koyulaşır,
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
            <Stop offset="0" stopColor={shade} stopOpacity={0.62} />
            <Stop offset="0.45" stopColor={shade} stopOpacity={dark ? 0.28 : 0.34} />
            <Stop offset="0.72" stopColor={c.background} stopOpacity={dark ? 0.55 : 0.5} />
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
