import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * Benim Şehrim'in parlak uygulama simgesi (tasarım: benim-sehrim.html): yukarıdan aşağı açıktan koyuya renk geçişi,
 * üstte ince parlama, ortada beyaz simge. Renk çifti [açık, koyu].
 */
export function GlossyIcon({ icon, colors, size = 56, dim = false }: { icon: IconName; colors: readonly [string, string]; size?: number; dim?: boolean }) {
  const r = Math.round(size * 0.3);
  const id = `g-${colors[0].slice(1)}-${colors[1].slice(1)}`;
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: r, shadowColor: colors[1], opacity: dim ? 0.45 : 1 }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors[0]} />
            <Stop offset="1" stopColor={colors[1]} />
          </LinearGradient>
          <LinearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.35} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={size} height={size} rx={r} fill={`url(#${id})`} />
        <Rect x={size * 0.08} y={size * 0.05} width={size * 0.84} height={size * 0.45} rx={r * 0.8} fill={`url(#${id}-shine)`} />
      </Svg>
      <MaterialIcons name={icon} size={Math.round(size * 0.46)} color="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
});
