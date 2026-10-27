import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useSettings } from '@/lib/settings';
import { fonts, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';

interface Props extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  hint?: string;
}

/** Etiketli form alanı; hata metni ekran okuyucuya da okunur. */
export function TextField({ label, error, hint, ...input }: Props) {
  const c = useThemeColors();
  const { rtl } = useSettings();
  return (
    <View style={styles.wrap}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={c.textMuted}
        style={[
          styles.input,
          { color: c.text, backgroundColor: c.surface, borderColor: error ? c.danger : c.border, textAlign: rtl ? 'right' : 'left' },
        ]}
        {...input}
      />
      {error ? (
        <AppText variant="caption" style={{ color: c.danger }} accessibilityLiveRegion="polite">{error}</AppText>
      ) : hint ? (
        <AppText variant="caption" muted>{hint}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  input: { minHeight: MIN_TOUCH, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 16 },
});
