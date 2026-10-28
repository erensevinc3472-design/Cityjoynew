import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, GUTTER, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';

/**
 * İnce üst şerit (Mesajlar, Profil; Instagram düzeni): solda düğme, başlık, sağda düğmeler. `centered` iken başlık
 * ortada ve öne çıkan yazı tipiyle (profil adı). Koyu bant, Keşfet başlığıyla aynı renkte.
 */
export function TopBar({ title, left, right, centered }: { title: string; left?: ReactNode; right?: ReactNode; centered?: boolean }) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.band, { paddingTop: insets.top + spacing.xs, backgroundColor: c.hero, borderBottomColor: c.border }]}>
      <View style={styles.bar}>
        <View style={centered ? styles.side : undefined}>{left}</View>
        <AppText
          accessibilityRole="header"
          numberOfLines={1}
          style={[centered ? styles.display : styles.title, { color: c.heroText }]}>
          {title}
        </AppText>
        <View style={[styles.row, centered && styles.sideEnd]}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: { borderBottomWidth: StyleSheet.hairlineWidth },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: GUTTER, minHeight: 52, width: '100%', maxWidth: 640, alignSelf: 'center' },
  title: { flex: 1, fontFamily: fonts.heading, fontSize: 19, lineHeight: 24 },
  display: { flex: 1.6, textAlign: 'center', fontFamily: fonts.display, fontSize: 20, lineHeight: 26, letterSpacing: 0.3 },
  side: { flex: 1, flexDirection: 'row' },
  sideEnd: { flex: 1, justifyContent: 'flex-end' },
  row: { flexDirection: 'row', gap: spacing.xs },
});
