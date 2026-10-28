import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Kartların arkasındaki çizim sahneleri (13. madde 29). Gerçek fotoğraflar panelden yüklenebilir olunca (Storage,
 * Blaze) yerlerini fotoğraflar alacak; o zamana kadar her modülün kendi renginde sade bir çizim yavaşça kayar.
 */
export type SceneKind =
  | 'city' | 'travel' | 'social' | 'urgent' | 'townhall' | 'neighbourhood' | 'showcase' | 'cover'
  | 'events' | 'activities' | 'news' | 'contests' | 'polls' | 'clubs' | 'deals';

interface Scene {
  sky: string;
  sun: string;
  sunX: number;
  far: string;
  farFill: string;
  near: string;
  nearFill: string;
  detail?: string;
}

// Hepsi 180x200 çizim alanında; kart boyutuna göre "slice" ile doldurulur.
const BASE_SCENES = {
  city: {
    sky: '#174A50', sun: '#E2B277', sunX: 130, farFill: '#22666B', nearFill: '#0F343A',
    far: 'M0 130 L40 96 L78 118 L120 74 L180 110 L180 200 L0 200 Z',
    near: 'M0 152 v-26 h16 v26 M22 152 v-40 h20 v40 M48 152 v-18 a20 20 0 0 1 40 0 v18 M66 116 v-22 h4 v22 M96 152 v-34 h18 v34 M120 152 v-48 h12 v48 M138 152 v-28 h24 v28 M0 152 h180 v48 H0 Z',
  },
  travel: {
    sky: '#1D3E63', sun: '#F5C77E', sunX: 50, farFill: '#2D5C8A', nearFill: '#15304D',
    far: 'M0 128 L50 70 L84 104 L118 58 L180 120 L180 200 L0 200 Z',
    near: 'M0 160 C40 140 80 172 120 150 C150 136 170 146 180 140 L180 200 L0 200 Z',
    detail: 'M92 200 C96 176 110 166 126 158',
  },
  social: {
    sky: '#4A2A57', sun: '#F2A7C3', sunX: 136, farFill: '#6B3F7C', nearFill: '#2E1838',
    far: 'M-10 150 a50 50 0 0 1 100 0 Z M70 160 a56 56 0 0 1 112 0 Z',
    near: 'M0 170 C50 150 120 176 180 158 L180 200 L0 200 Z',
    detail: 'M40 108 a8 8 0 1 0 0.1 0 M128 100 a10 10 0 1 0 0.1 0',
  },
  urgent: {
    sky: '#5A2124', sun: '#F87171', sunX: 132, farFill: '#3E1517', nearFill: '#F87171',
    far: 'M0 140 L180 140 L180 200 L0 200 Z',
    near: 'M0 140 h40 l10 -22 l14 44 l12 -60 l12 50 l8 -12 h84 v4 H0 Z',
    detail: 'M16 70 h20 M26 60 v20',
  },
  townhall: {
    sky: '#174A50', sun: '#E2B277', sunX: 140, farFill: '#22666B', nearFill: '#0F343A',
    far: 'M0 140 L50 108 L100 128 L150 92 L180 110 L180 200 L0 200 Z',
    near: 'M40 160 V112 L90 84 L140 112 V160 Z M0 160 H180 V200 H0 Z',
    detail: 'M54 160 V122 M72 160 V122 M90 160 V122 M108 160 V122 M126 160 V122 M90 84 V64 M90 64 h14 v8 h-14',
  },
  neighbourhood: {
    sky: '#3A4A22', sun: '#E2B277', sunX: 140, farFill: '#4C5F2C', nearFill: '#24301A',
    far: 'M0 150 C50 130 120 146 180 128 L180 200 L0 200 Z',
    near: 'M0 200 V136 L30 116 L60 136 V200 Z M70 200 V124 L104 100 L138 124 V200 Z M146 200 V140 L166 128 L186 140 V200 Z',
    detail: 'M0 176 H180',
  },
  showcase: {
    sky: '#4A2A57', sun: '#F2A7C3', sunX: 140, farFill: '#6B3F7C', nearFill: '#2E1838',
    far: 'M0 170 C40 132 80 160 120 130 C150 110 170 124 180 118 V200 H0 Z',
    near: 'M0 186 C50 172 120 192 180 176 V200 H0 Z',
    detail: 'M40 64 l6 12 13 2 -9 9 2 13 -12 -6 -12 6 2 -13 -9 -9 13 -2 z',
  },
  cover: {
    sky: '#0F3036', sun: '#E2B277', sunX: 140, farFill: '#1C4A50', nearFill: '#123238',
    far: 'M0 120 L32 92 L60 106 L92 62 L120 90 L146 76 L180 100 L180 200 L0 200 Z',
    near: 'M0 150 v-20 h10 v20 M16 150 v-30 h12 v30 M34 150 v-16 h10 v16 M62 150 v-14 a16 16 0 0 1 32 0 v14 M78 120 v-18 M104 150 v-26 h12 v26 M122 150 v-18 h14 v18 M146 150 v-34 h9 v34 M160 150 v-22 h16 v22 M0 150 H180 V200 H0 Z',
    detail: 'M108 124 v-26',
  },
};

/** Sosyal Harmoni bölümleri. */
const SOCIAL_SCENES = {
  events: {
    sky: '#3B1F4F', sun: '#F5C77E', sunX: 90, farFill: '#5B2E73', nearFill: '#1F1030',
    far: 'M20 40 L60 150 L0 150 Z M160 40 L180 150 L120 150 Z',
    near: 'M0 150 H180 V200 H0 Z M30 150 a10 10 0 1 1 0.1 0 M60 152 a12 12 0 1 1 0.1 0 M96 150 a10 10 0 1 1 0.1 0 M130 152 a12 12 0 1 1 0.1 0 M160 150 a10 10 0 1 1 0.1 0',
    detail: 'M40 112 h100 M50 100 v12 M130 100 v12',
  },
  activities: {
    sky: '#1E4D3A', sun: '#F5C77E', sunX: 140, farFill: '#2F6B4F', nearFill: '#143326',
    far: 'M0 140 L40 80 L80 130 L120 70 L180 140 V200 H0 Z',
    near: 'M0 170 C40 150 90 180 180 160 V200 H0 Z M30 160 l10 -30 l10 30 Z M140 156 l12 -36 l12 36 Z',
    detail: 'M70 150 l8 -14 l8 14 M78 136 v-8',
  },
  news: {
    sky: '#1F3A4F', sun: '#9CC9F5', sunX: 140, farFill: '#2C5470', nearFill: '#122636',
    far: 'M24 60 H150 V170 H24 Z',
    near: 'M0 170 H180 V200 H0 Z',
    detail: 'M36 76 H138 M36 92 H96 M36 104 H96 M36 116 H96 M36 128 H96 M106 92 H138 V128 H106 Z M36 146 H138',
  },
  contests: {
    sky: '#4A3A15', sun: '#F5C77E', sunX: 140, farFill: '#6B5520', nearFill: '#2A200A',
    far: 'M60 70 H120 V96 C120 120 104 132 90 132 C76 132 60 120 60 96 Z',
    near: 'M76 160 H104 V146 H76 Z M64 172 H116 V160 H64 Z M0 172 H180 V200 H0 Z',
    detail: 'M60 80 C44 80 44 104 62 106 M120 80 C136 80 136 104 118 106 M90 132 V146',
  },
  polls: {
    sky: '#1D3E63', sun: '#9CC9F5', sunX: 146, farFill: '#2D5C8A', nearFill: '#15304D',
    far: 'M30 150 V110 H54 V150 Z M66 150 V70 H90 V150 Z M102 150 V96 H126 V150 Z',
    near: 'M0 150 H180 V200 H0 Z',
    detail: 'M138 130 l6 6 l12 -16',
  },
  clubs: {
    sky: '#173F2A', sun: '#E2B277', sunX: 150, farFill: '#235C3D', nearFill: '#0E2A1B',
    far: 'M0 120 C40 96 140 96 180 120 V200 H0 Z',
    near: 'M10 160 C50 140 130 140 170 160 V200 H10 Z',
    detail: 'M90 140 V176 M70 158 a20 8 0 1 0 40 0 a20 8 0 1 0 -40 0',
  },
  deals: {
    sky: '#4A2A1F', sun: '#F2A47C', sunX: 140, farFill: '#6B3D2C', nearFill: '#2A150E',
    far: 'M40 80 L110 80 L150 120 L110 160 L40 160 Z',
    near: 'M0 176 H180 V200 H0 Z',
    detail: 'M58 120 a6 6 0 1 0 0.1 0 M80 110 L100 132 M82 132 l0 0',
  },
} satisfies Record<string, Scene>;
const SCENES: Record<SceneKind, Scene> = { ...BASE_SCENES, ...SOCIAL_SCENES };

/** Telefonun "hareketi azalt" ayarı açık mı? */
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

/** Kartı dolduran sahne; arkada yavaşça yakınlaşıp kayar ("hareketi azalt" açıksa durur). */
export function SceneArt({ kind, still }: { kind: SceneKind; still?: boolean }) {
  const s = SCENES[kind];
  const reduce = useReduceMotion();
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce || still) {
      t.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 14000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 14000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, still, t]);

  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [1.04, 1.14] });
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: s.sky, transform: [{ scale }, { translateX }] }]}>
      <Svg width="100%" height="100%" viewBox="0 0 180 200" preserveAspectRatio="xMidYMid slice">
        <Circle cx={s.sunX} cy={46} r={24} fill={s.sun} opacity={0.7} />
        <Path d={s.far} fill={s.farFill} />
        <Path d={s.near} fill={s.nearFill} />
        {s.detail ? <Path d={s.detail} fill="none" stroke={s.sun} strokeWidth={2} strokeLinecap="round" opacity={0.85} /> : null}
      </Svg>
    </Animated.View>
  );
}

/** Sahnenin gök rengi (tam ekran kullanımda üst boşluğu doldurmak için). */
export const sceneSky = (kind: SceneKind) => SCENES[kind].sky;

/** Kartın kenar rengi: sahnenin vurgu rengi, hafif. */
export const sceneRim = (kind: SceneKind) => `${SCENES[kind].sun}59`;
