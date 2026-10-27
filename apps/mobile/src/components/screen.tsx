import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/** Güvenli alan, arka plan ve geniş ekranlarda (tablet, web) ortalanmış içerik. */
export function Screen({ children }: PropsWithChildren) {
  const c = useThemeColors();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.inner}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, alignItems: 'center' },
  inner: { flex: 1, width: '100%', maxWidth: 640, paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.md },
});
