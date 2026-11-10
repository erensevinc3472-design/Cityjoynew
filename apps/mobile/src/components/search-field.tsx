import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, TextInput, View } from 'react-native';

import { useSettings } from '@/lib/settings';
import { fonts, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useResolvedScheme, useThemeColors } from '@/theme/use-theme';

export function SearchField({
  value,
  onChangeText,
  placeholder,
  autoFocus,
  onSubmitEditing,
  compact,
  glass,
}: {
  value: string;
  onChangeText(v: string): void;
  placeholder: string;
  autoFocus?: boolean;
  onSubmitEditing?(): void;
  /** İnce cam görünüm (Benim Şehrim alt sayfaları). */
  compact?: boolean;
  /** Fotoğrafın üstünde duran cam kutu (koyu modda yarı saydam, ince açık çerçeve). */
  glass?: boolean;
}) {
  const c = useThemeColors();
  const { rtl } = useSettings();
  const dark = useResolvedScheme() === 'dark';
  const bg = glass && dark ? { backgroundColor: 'rgba(8, 32, 36, 0.55)', borderColor: 'rgba(235, 248, 245, 0.22)' } : { backgroundColor: c.surfaceStrong, borderColor: c.border };
  return (
    <View style={[styles.box, compact && styles.compact, glass && styles.glass, bg]}>
      <MaterialIcons name="search" size={compact ? 19 : 22} color={c.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        accessibilityLabel={placeholder}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        autoFocus={autoFocus}
        returnKeyType="search"
        onSubmitEditing={onSubmitEditing}
        style={[styles.input, compact && styles.compactInput, glass && styles.glassInput, { color: c.textStrong, textAlign: rtl ? 'right' : 'left' }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  glass: { minHeight: 48 },
  compact: { minHeight: MIN_TOUCH, paddingHorizontal: 14 },
  compactInput: { fontSize: 14, paddingVertical: 10 },
  glassInput: { fontSize: 15 },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 16, paddingVertical: spacing.sm },
});
