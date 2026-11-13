import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { fonts } from '@/theme/tokens';

/** Düzenleyici her iki temada da koyu: medyanın üstünde okunur (Instagram ve taslak gibi). */
export const ED = {
  bg: '#071417',
  panel: '#0D2226',
  chip: '#163036',
  line: 'rgba(255,255,255,0.12)',
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.65)',
  gold: '#E2B277',
  onGold: '#1B1206',
  danger: '#E74C3C',
} as const;

export type IconName = ComponentProps<typeof MaterialIcons>['name'];

/** Yuvarlak, yarı saydam simge düğmesi (sağdaki araç çubuğu, kapat, geri al). */
export function RoundButton({ icon, label, onPress, active, size = 44, style, disabled }: { icon: IconName; label: string; onPress(): void; active?: boolean; size?: number; style?: StyleProp<ViewStyle>; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? ED.gold : 'rgba(0,0,0,0.45)', opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
        style,
      ]}>
      <MaterialIcons name={icon} size={size * 0.52} color={active ? ED.onGold : ED.text} />
    </Pressable>
  );
}

/** Metin düğmesi ("Bitti", "Vazgeç"). */
export function TextButton({ title, onPress, gold }: { title: string; onPress(): void; gold?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={10} style={({ pressed }) => [styles.textBtn, gold && styles.goldBtn, { opacity: pressed ? 0.7 : 1 }]}>
      <AppText style={[styles.textBtnLabel, gold && { color: ED.onGold }]}>{title}</AppText>
    </Pressable>
  );
}

/** Renk yuvarlakları; seçilen beyaz halkayla. */
export function Swatches({ colors, value, onChange, label }: { colors: readonly string[]; value: string; onChange(c: string): void; label: string }) {
  return (
    <View style={styles.swatches} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {colors.map((c) => (
        <Pressable
          key={c}
          accessibilityRole="radio"
          accessibilityLabel={c}
          accessibilityState={{ selected: value === c }}
          onPress={() => onChange(c)}
          hitSlop={4}
          style={[styles.swatchRing, { borderColor: value === c ? ED.text : 'transparent' }]}>
          <View style={[styles.swatch, { backgroundColor: c, borderColor: c === '#111111' ? 'rgba(255,255,255,0.35)' : 'transparent' }]} />
        </Pressable>
      ))}
    </View>
  );
}

/** Seçmeli hap düğmeleri (yazı tipi, alt zemin, kırpma oranı). */
export function Pill({ title, selected, onPress, textStyle }: { title: string; selected: boolean; onPress(): void; textStyle?: object }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, selected ? { backgroundColor: ED.text, borderColor: ED.text } : { borderColor: ED.line, backgroundColor: 'rgba(0,0,0,0.35)' }, { opacity: pressed ? 0.75 : 1 }]}>
      <AppText numberOfLines={1} style={[styles.pillText, textStyle, { color: selected ? ED.bg : ED.text }]}>{title}</AppText>
    </Pressable>
  );
}

/** Alttan açılan koyu panel (çıkartmalar, renk, video). */
export function Sheet({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.sheet, style]}>
      <View style={styles.grab} />
      {children}
    </View>
  );
}

export function SheetLabel({ children }: { children: string }) {
  return <AppText style={styles.sheetLabel}>{children.toLocaleUpperCase()}</AppText>;
}

const styles = StyleSheet.create({
  textBtn: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  goldBtn: { backgroundColor: ED.gold, paddingHorizontal: 22, minHeight: 46, borderRadius: 23 },
  textBtnLabel: { color: ED.text, fontFamily: fonts.heading, fontSize: 16, lineHeight: 20 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  swatchRing: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 1 },
  pill: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 18 },
  sheet: { backgroundColor: ED.panel, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 8 },
  sheetLabel: { color: ED.muted, fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 16, letterSpacing: 1 },
});
