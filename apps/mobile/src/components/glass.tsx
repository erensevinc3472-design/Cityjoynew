import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useResolvedScheme } from '@/theme/use-theme';

/**
 * Koyu modda kartların "cam" dolgusu (taslaklar, 13. madde 35): sol üstten sağ alta hafifçe koyulaşan petrol yeşili.
 * Kapsayan kutuyu doldurur, dokunmayı engellemez; açık modda çizilmez (kartın kendi beyaz zemini kalır). `horizontal`:
 * yalnızca soldan sağa; alt alta dizilen liste satırlarında birleşme yerleri görünmez.
 */
export function GlassFill({ strong, horizontal }: { strong?: boolean; horizontal?: boolean }) {
  const scheme = useResolvedScheme();
  if (scheme !== 'dark') return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="g" x1="0" y1="0" x2="1" y2={horizontal ? 0 : 1}>
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
/** Cam taslağındaki buzlu yüzey: arkadaki ışığı gösteren yarı saydam açık geçiş (yalnızca koyu mod). */
export function FrostFill() {
  const scheme = useResolvedScheme();
  if (scheme !== 'dark') return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="f" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#DCF0EC" stopOpacity={0.12} />
            <Stop offset="1" stopColor="#DCF0EC" stopOpacity={0.045} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#f)" />
      </Svg>
    </View>
  );
}

/**
 * Koyu modda ekranın üstündeki yumuşak ışık. `warm`: Benim Şehrim alt sayfalarında altın tonlu ışık (cam taslağında
 * şehir fotoğrafının verdiği sıcaklık; il fotoğrafı gelene kadar).
 */
export function ScreenGlow({ warm }: { warm?: boolean }) {
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
        {warm ? (
          <>
            <Defs>
              <RadialGradient id="w" cx="62%" cy="22%" rx="60%" ry="34%" fx="62%" fy="22%">
                <Stop offset="0" stopColor="#B8954A" stopOpacity={0.42} />
                <Stop offset="0.55" stopColor="#7C6A35" stopOpacity={0.14} />
                <Stop offset="1" stopColor="#7C6A35" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#w)" />
          </>
        ) : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 520 },
});
