import { StatusBar } from 'expo-status-bar';
import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GUTTER, spacing } from '@/theme/tokens';
import { useResolvedScheme, useThemeColors } from '@/theme/use-theme';

interface Props {
  /** Üst bant içeriği (HeroHeader). Açık modda koyu petrol yeşili, koyu modda zeminle aynı. */
  header?: ReactNode;
  /** Altta sabit duran içerik (alt gezinme çubuğu); güvenli alanı kendisi bırakır. */
  footer?: ReactNode;
}

/** Güvenli alan, zemin, üst bant ve geniş ekranlarda (tablet, web) ortalanmış içerik. */
export function Screen({ header, footer, children }: PropsWithChildren<Props>) {
  const c = useThemeColors();
  const scheme = useResolvedScheme();
  const insets = useSafeAreaInsets();
  // Üst bant her iki modda da koyu: durum çubuğu yazısı açık renk.
  const statusStyle = header || scheme === 'dark' ? 'light' : 'dark';

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar style={statusStyle} />
      {header ? (
        <View style={[styles.band, { backgroundColor: c.hero, paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.inner}>{header}</View>
        </View>
      ) : (
        <View style={{ height: insets.top }} />
      )}
      <View style={[styles.inner, styles.body, { paddingBottom: footer ? 0 : insets.bottom }]}>{children}</View>
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  band: { alignItems: 'center', paddingBottom: spacing.lg },
  inner: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: GUTTER },
  body: { flex: 1, paddingTop: spacing.md, gap: spacing.md },
});
