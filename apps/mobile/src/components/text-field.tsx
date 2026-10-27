import { useState } from 'react';
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
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={c.textMuted}
        style={[
          styles.input,
          input.multiline && styles.multiline,
          {
            color: c.textStrong,
            backgroundColor: c.surfaceStrong,
            borderColor: error ? c.danger : focused ? c.primary : c.border,
            textAlign: rtl ? 'right' : 'left',
          },
        ]}
        {...input}
        onFocus={(e) => {
          setFocused(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          input.onBlur?.(e);
        }}
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
  input: { minHeight: MIN_TOUCH, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 16 },
  // Çok satırlı alan (tanıtım, değerlendirme): birkaç satır görünür, yazı üstten başlar.
  multiline: { minHeight: 112, paddingTop: spacing.sm, paddingBottom: spacing.sm, textAlignVertical: 'top' },
});
