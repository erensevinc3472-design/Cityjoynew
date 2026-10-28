import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, GUTTER, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';

/**
 * Sekme ekranlarının ince üst şeridi (Mesajlar, Profil; Instagram düzeni): solda isteğe bağlı düğme ve kalın başlık,
 * sağda düğmeler. Koyu bant, Keşfet başlığıyla aynı renkte.
 */
export function TopBar({ title, left, right }: { title: string; left?: ReactNode; right?: ReactNode }) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.band, { paddingTop: insets.top + spacing.xs, backgroundColor: c.hero, borderBottomColor: c.border }]}>
      <View style={styles.bar}>
        {left}
        <AppText accessibilityRole="header" numberOfLines={1} style={[styles.title, { color: c.heroText }]}>{title}</AppText>
        <View style={styles.row}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: { borderBottomWidth: StyleSheet.hairlineWidth },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: GUTTER, minHeight: 52, width: '100%', maxWidth: 640, alignSelf: 'center' },
  title: { flex: 1, fontFamily: fonts.heading, fontSize: 19, lineHeight: 24 },
  row: { flexDirection: 'row', gap: spacing.xs },
});
