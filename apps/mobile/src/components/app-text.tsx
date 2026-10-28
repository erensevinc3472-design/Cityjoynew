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
      style={[align, styles[variant], { color: muted ? c.textMuted : variant === 'title' || variant === 'subtitle' ? c.textStrong : c.text }, style]}
      {...rest}
    />
  );
}

const WEB_AUTO_DIR = (Platform.OS === 'web' ? { dir: 'auto' } : {}) as object;

const styles = StyleSheet.create({
  title: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 31 },
  subtitle: { fontFamily: fonts.headingSemi, fontSize: 17, lineHeight: 23 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
});
