import { StatusBar } from 'expo-status-bar';
import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoverBackdrop } from '@/components/city-cover';
import { ScreenGlow } from '@/components/glass';
import type { Photo } from '@cityjoy/shared';
import { GUTTER, spacing } from '@/theme/tokens';
import { useResolvedScheme, useThemeColors } from '@/theme/use-theme';

interface Props {
  /** Üst bant içeriği (HeroHeader). Açık modda koyu petrol yeşili, koyu modda zeminle aynı. */
  header?: ReactNode;
  /** Altta sabit duran içerik (alt gezinme çubuğu); güvenli alanı kendisi bırakır. */
  footer?: ReactNode;
  /** Üstte altın tonlu ışık (Benim Şehrim alt sayfaları). */
  warm?: boolean;
  /** Üst bandın arkasında, sayfaya eriyen fotoğraf (Benim Şehrim alt sayfalarında ilin kapağı). */
  cover?: Pick<Photo, 'url' | 'path'>;
  /** Fotoğraf varken bandın alt boşluğu; başlığın altında arama / süzgeç duran sayfalarda daha az. */
  coverPad?: number;
}

/** Güvenli alan, zemin, üst bant ve geniş ekranlarda (tablet, web) ortalanmış içerik. */
export function Screen({ header, footer, warm, cover, coverPad = 92, children }: PropsWithChildren<Props>) {
  const c = useThemeColors();
  const scheme = useResolvedScheme();
  const insets = useSafeAreaInsets();
  const [bandHeight, setBandHeight] = useState(0);
  // Üst bant her iki modda da koyu: durum çubuğu yazısı açık renk.
  const statusStyle = header || scheme === 'dark' ? 'light' : 'dark';

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar style={statusStyle} />
      {/* Fotoğraf başlığın altında bir şerit kadar açık görünür, sonra sayfaya erir (Eren'in örnekleri). Işığın altında
          durur ki fotoğrafın bittiği yerde çizgi belirmesin; altın ışık fotoğraf varken gerekmez. */}
      {cover && header ? <CoverBackdrop photo={cover} height={bandHeight + 40} /> : null}
      <ScreenGlow warm={warm && !cover} />
      {header ? (
        <View
          onLayout={(e) => setBandHeight(Math.round(e.nativeEvent.layout.height))}
          style={[styles.band, cover ? { paddingBottom: coverPad } : null, { backgroundColor: scheme === 'dark' || cover ? 'transparent' : c.hero, paddingTop: insets.top + spacing.sm }]}>
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
