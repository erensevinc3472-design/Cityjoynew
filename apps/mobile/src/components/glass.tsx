import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useResolvedScheme } from '@/theme/use-theme';

/**
 * Koyu modda kartların "cam" dolgusu (taslaklar, 13. madde 35): sol üstten sağ alta hafifçe koyulaşan petrol yeşili.
 * Kapsayan kutuyu doldurur, dokunmayı engellemez; açık modda çizilmez (kartın kendi beyaz zemini kalır).
 */
export function GlassFill({ strong }: { strong?: boolean }) {
  const scheme = useResolvedScheme();
  if (scheme !== 'dark') return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#14404A" stopOpacity={strong ? 0.95 : 0.85} />
            <Stop offset="1" stopColor="#0D3238" stopOpacity={strong ? 0.75 : 0.6} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#g)" />
      </Svg>
    </View>
  );
}

/** Koyu modda ekranın sağ üstündeki yumuşak ışık (zeminin derinliği). */
export function ScreenGlow() {
  const scheme = useResolvedScheme();
  if (scheme !== 'dark') return null;
  return (
    <View pointerEvents="none" style={styles.glow}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="r" cx="85%" cy="0%" rx="90%" ry="55%" fx="85%" fy="0%">
            <Stop offset="0" stopColor="#13454C" stopOpacity={0.9} />
            <Stop offset="1" stopColor="#13454C" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#r)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 520 },
});
