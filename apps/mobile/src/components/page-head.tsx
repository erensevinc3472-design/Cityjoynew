import { useState, type PropsWithChildren } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { Photo } from '@cityjoy/shared';

import { useSettings } from '@/lib/settings';
import { fonts, GUTTER, radius, spacing } from '@/theme/tokens';
import { useResolvedScheme, useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';
import { CoverBackdrop } from './city-cover';
import { RoundButton, type HeaderAction } from './hero-header';

/** Fotoğraf ya da koyu zemin üstünde camlı yuvarlak düğme; açık zeminde kenarlıklı açık düğme. */
function HeadButton({ light, ...a }: HeaderAction & { light: boolean }) {
  const c = useThemeColors();
  if (light) return <RoundButton {...a} />;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a.label} onPress={a.onPress} hitSlop={4} style={({ pressed }) => [styles.btn, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
      <MaterialIcons name={a.icon} size={21} color={c.textStrong} />
    </Pressable>
  );
}

/**
 * Sayfayla birlikte kayan ince üst kısım (Önemli Kurumlar düzeni, Eren 10 Kasım 2026: "sabit kalın başlık kaba duruyor").
 * Geri düğmesi, kalın başlık, kısa açıklama ve altın çizgi; altına isteğe bağlı içerik (arama, düğmeler). İlin kapak
 * fotoğrafı varsa arkasında, sayfaya eriyerek. `Screen bleed` ile ve kaydırılan içeriğin ilk öğesi olarak kullanılır;
 * içerik `PAGE_CONTENT` yan boşluğunu almalıdır.
 */
export function PageHead({
  title,
  subtitle,
  onBack,
  right,
  cover,
  extend = 96,
  children,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  onBack?(): void;
  right?: HeaderAction;
  cover?: Pick<Photo, 'url' | 'path'>;
  /** Fotoğrafın üst kısmın altına ne kadar taştığı (altta duran arama / düğmelerin arkasına). */
  extend?: number;
}>) {
  const c = useThemeColors();
  const dark = useResolvedScheme() === 'dark';
  const { rtl } = useSettings();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [h, setH] = useState(0);
  // Fotoğraf varsa ya da koyu modda başlık açık renk; açık modda fotoğraf yoksa koyu.
  const light = dark || !!cover;
  return (
    <View onLayout={(e) => setH(Math.round(e.nativeEvent.layout.height))} style={[styles.head, { paddingTop: insets.top + spacing.sm }]}>
      {cover && h ? (
        <View pointerEvents="none" style={[styles.cover, { height: h + extend }]}>
          <CoverBackdrop photo={cover} height={h + extend} />
        </View>
      ) : null}
      <View style={styles.titleRow}>
        {onBack ? <HeadButton light={light} icon={rtl ? 'arrow-forward' : 'arrow-back'} label={t('common.back')} onPress={onBack} /> : null}
        <View style={styles.flex}>
          <AppText accessibilityRole="header" numberOfLines={2} style={[styles.title, light ? styles.shadow : null, { color: light ? c.heroText : c.textStrong }]}>{title}</AppText>
          {subtitle ? <AppText numberOfLines={1} style={[styles.sub, { color: light ? c.heroMuted : c.textMuted }]}>{subtitle}</AppText> : null}
          <View style={[styles.rule, { backgroundColor: c.heroAccent }]} />
        </View>
        {right ? <HeadButton light={light} {...right} /> : null}
      </View>
      {children}
    </View>
  );
}

/** Kaydırılan içeriğin yan boşluğu ve geniş ekranda ortalama (PageHead kullanan sayfalar). */
export const PAGE_CONTENT: ViewStyle = { paddingHorizontal: GUTTER, width: '100%', maxWidth: 640, alignSelf: 'center' };

/** Yana kayan düğme şeridi sayfa kenarına kadar uzansın (PAGE_CONTENT içinde). */
export const BLEED_STRIP: ViewStyle = { marginHorizontal: -GUTTER };
export const BLEED_STRIP_CONTENT: ViewStyle = { paddingHorizontal: GUTTER };

/** Sayfanın altında güvenli alan + boşluk. */
export function usePageBottom() {
  return useSafeAreaInsets().bottom + spacing.xl;
}

const styles = StyleSheet.create({
  head: { gap: spacing.sm + 2, paddingBottom: 2 },
  cover: { position: 'absolute', top: 0, start: -GUTTER, end: -GUTTER },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  flex: { flex: 1 },
  btn: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.heading, fontSize: 19, lineHeight: 24, letterSpacing: -0.3 },
  shadow: { textShadowColor: 'rgba(0, 0, 0, 0.3)', textShadowRadius: 6 },
  sub: { fontSize: 12, lineHeight: 16 },
  rule: { width: 26, height: 2.5, borderRadius: 2, marginTop: 6 },
});
