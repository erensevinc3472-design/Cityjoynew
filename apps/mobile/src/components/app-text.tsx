import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { useSettings } from '@/lib/settings';
import { fonts } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type Variant = 'title' | 'subtitle' | 'body' | 'label' | 'caption';

export function AppText({ variant = 'body', muted, style, ...rest }: TextProps & { variant?: Variant; muted?: boolean }) {
  const c = useThemeColors();
  const { rtl } = useSettings();
  // Sağdan sola dilde Latin harfli adlar (il, mahalle) da sağa yaslanır; harf sırası ise
  // metnin kendi yönüne göre kalır ("19 Mayıs Mahallesi" bozulmaz).
  const align = { textAlign: rtl ? 'right' : 'left' } as const;
  return (
    <Text
      {...WEB_AUTO_DIR}
      accessibilityRole={variant === 'title' ? 'header' : undefined}
      style={[align, styles[variant], { color: muted ? c.textMuted : c.text }, style]}
      {...rest}
    />
  );
}

const WEB_AUTO_DIR = (Platform.OS === 'web' ? { dir: 'auto' } : {}) as object;

const styles = StyleSheet.create({
  title: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 36 },
  subtitle: { fontFamily: fonts.headingSemi, fontSize: 18, lineHeight: 26 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
});
