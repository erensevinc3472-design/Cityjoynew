import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/** Tek seçimli küçük düğmeler (kategori, gün, süre). Seçili olan dolu görünür; ekran okuyucuya "seçili" okunur. */
export function Chips<T extends string | number>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange(v: T): void; label: string }) {
  const c = useThemeColors();
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected, checked: selected }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: selected ? c.primary : c.surface, borderColor: selected ? c.primary : c.border, opacity: pressed ? 0.85 : 1 },
            ]}>
            <AppText variant="label" style={{ color: selected ? c.onPrimary : c.textStrong }}>{o.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
});
