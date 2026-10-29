import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';

const H = 200;
const HORIZON = 92;
const DASH = 18;
const GAP = 16;
const STARS = [
  [0.08, 18, 1.2], [0.2, 40, 0.9], [0.31, 12, 1.4], [0.44, 30, 0.8], [0.58, 16, 1.1], [0.69, 44, 1.3], [0.8, 22, 0.9], [0.92, 36, 1.2],
  [0.14, 62, 0.8], [0.38, 58, 1], [0.63, 70, 0.8], [0.86, 60, 1],
] as const;

/**
 * Yoldayım'ın gece yolu: yıldızlı gök, tepeler, ufka giden yol, akan orta şerit ve farları yanan araba. Hareket
 * "hareketi azalt" açıksa ya da konum henüz yoksa (moving false) durur.
 */
export function NightRoad({ width, moving = true }: { width: number; moving?: boolean }) {
  const flow = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loops: Animated.CompositeAnimation[] = [];
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled || reduce || !moving) return;
        loops = [
          Animated.loop(Animated.timing(flow, { toValue: 1, duration: 700, easing: Easing.linear, useNativeDriver: true })),
          Animated.loop(
            Animated.sequence([
              Animated.timing(bob, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
              Animated.timing(bob, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            ]),
          ),
        ];
        loops.forEach((l) => l.start());
      });
    return () => {
      cancelled = true;
      loops.forEach((l) => l.stop());
    };
  }, [flow, bob, moving]);

  const cx = width / 2;
  const roadTop = width * 0.035;
  const roadBottom = width * 0.42;
  const dashes = Math.ceil((H - HORIZON) / (DASH + GAP)) + 2;

  return (
    <View style={[styles.wrap, { width, height: H }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="nr-sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#071A22" />
            <Stop offset="1" stopColor="#15434B" />
          </LinearGradient>
          <LinearGradient id="nr-road" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1E2B30" />
            <Stop offset="1" stopColor="#2C3B40" />
          </LinearGradient>
          <LinearGradient id="nr-light" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor="#FFE7A3" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#FFE7A3" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={H} fill="url(#nr-sky)" />
        {STARS.map(([x, y, r], i) => (
          <Circle key={i} cx={x * width} cy={y} r={r} fill="#FFFFFF" opacity={0.7} />
        ))}
        <Circle cx={width * 0.86} cy={74} r={11} fill="#F6E7B8" opacity={0.9} />
        <Circle cx={width * 0.86 + 5} cy={70} r={10} fill="#0B2229" />
        {/* Tepeler. */}
        <Path d={`M0 ${HORIZON + 4} Q ${width * 0.18} ${HORIZON - 34} ${width * 0.38} ${HORIZON} T ${width * 0.72} ${HORIZON - 6} T ${width} ${HORIZON - 18} L ${width} ${H} L 0 ${H} Z`} fill="#0E3138" />
        <Path d={`M0 ${HORIZON + 10} Q ${width * 0.3} ${HORIZON - 10} ${width * 0.55} ${HORIZON + 6} T ${width} ${HORIZON + 2} L ${width} ${H} L 0 ${H} Z`} fill="#123A40" />
        {/* Yol ve kenar çizgileri. */}
        <Polygon points={`${cx - roadTop},${HORIZON} ${cx + roadTop},${HORIZON} ${cx + roadBottom},${H} ${cx - roadBottom},${H}`} fill="url(#nr-road)" />
        <Path d={`M ${cx - roadTop + 2} ${HORIZON} L ${cx - roadBottom + 10} ${H}`} stroke="#D9A066" strokeWidth={2} opacity={0.8} />
        <Path d={`M ${cx + roadTop - 2} ${HORIZON} L ${cx + roadBottom - 10} ${H}`} stroke="#D9A066" strokeWidth={2} opacity={0.8} />
        {/* Far ışığı. */}
        <Polygon points={`${cx - 16},${H - 30} ${cx + 16},${H - 30} ${cx + roadTop * 3},${HORIZON + 30} ${cx - roadTop * 3},${HORIZON + 30}`} fill="url(#nr-light)" />
      </Svg>
      {/* Akan orta şerit: ufuktan aşağı. */}
      <View style={[styles.lane, { left: cx - 2, top: HORIZON, height: H - HORIZON }]}>
        <Animated.View style={{ transform: [{ translateY: flow.interpolate({ inputRange: [0, 1], outputRange: [-(DASH + GAP), 0] }) }] }}>
          {Array.from({ length: dashes }, (_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </Animated.View>
      </View>
      <Animated.View style={[styles.car, { left: cx - 24, transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }] }]}>
        <MaterialIcons name="directions-car" size={48} color="#FFFFFF" />
      </Animated.View>
    </View>
  );
}

export const NIGHT_ROAD_HEIGHT = H;

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  lane: { position: 'absolute', width: 4, overflow: 'hidden' },
  dash: { width: 4, height: DASH, marginBottom: GAP, borderRadius: 2, backgroundColor: '#F6E7B8', opacity: 0.9 },
  car: { position: 'absolute', bottom: 2 },
});
