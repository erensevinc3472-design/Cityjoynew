import { Image } from 'expo-image';
import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { GUTTER, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { useArt } from '@/lib/app-art';

/** Sayfanın en altında kenardan kenara şehir silüeti; üst kenarı sayfa rengine erir. ScrollView içeriğinin sonuna konur. */
export function Skyline({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useThemeColors();
  const art = useArt()('citySkyline');
  const id = 'skyfade' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View pointerEvents="none" style={[styles.skyline, style]}>
      <Image source={art?.source} onError={art?.onError} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
      <Svg width="100%" height="100%" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.background} stopOpacity={1} />
            <Stop offset="0.45" stopColor={c.background} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  skyline: { marginHorizontal: -GUTTER, marginBottom: -spacing.xl, marginTop: spacing.sm, aspectRatio: 1200 / 262 },
});
