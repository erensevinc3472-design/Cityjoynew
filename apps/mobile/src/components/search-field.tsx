import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, TextInput, View } from 'react-native';

import { useSettings } from '@/lib/settings';
import { fonts, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

export function SearchField({
  value,
  onChangeText,
  placeholder,
  autoFocus,
  onSubmitEditing,
}: {
  value: string;
  onChangeText(v: string): void;
  placeholder: string;
  autoFocus?: boolean;
  onSubmitEditing?(): void;
}) {
  const c = useThemeColors();
  const { rtl } = useSettings();
  return (
    <View style={[styles.box, { backgroundColor: c.surfaceStrong, borderColor: c.border }]}>
      <MaterialIcons name="search" size={22} color={c.textMuted} />
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
        style={[styles.input, { color: c.textStrong, textAlign: rtl ? 'right' : 'left' }]}
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
  input: { flex: 1, fontFamily: fonts.body, fontSize: 16, paddingVertical: spacing.sm },
});
