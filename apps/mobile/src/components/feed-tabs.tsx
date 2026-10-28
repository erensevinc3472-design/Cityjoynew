import { Pressable, StyleSheet, View } from 'react-native';

import { fonts, GUTTER } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';

/** Akışın üstündeki sade sekmeler: eşit genişlikte yazılar, seçili olanın altında altın çizgi. */
export function FeedTabs<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange(v: T): void }) {
  const c = useThemeColors();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={[styles.row, { borderBottomColor: c.border }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.7 : 1 }]}>
            <AppText numberOfLines={1} style={[styles.text, { color: selected ? c.textStrong : c.textMuted, fontFamily: selected ? fonts.bodySemi : fonts.bodyMedium }]}>{o.label}</AppText>
            <View style={[styles.line, { backgroundColor: selected ? c.accent : 'transparent' }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginHorizontal: -GUTTER, paddingHorizontal: GUTTER - 4, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'flex-end' },
  text: { fontSize: 14, lineHeight: 18, paddingBottom: 9, textAlign: 'center' },
  line: { height: 2.5, borderRadius: 2, alignSelf: 'stretch', marginHorizontal: 10 },
});
