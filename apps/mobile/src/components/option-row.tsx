import { MaterialIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useSettings } from '@/lib/settings';
import { MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';

interface Props {
  title: string;
  subtitle?: string;
  selected?: boolean;
  /** Seçince bir sonraki adıma geçiliyorsa ok gösterilir. */
  showChevron?: boolean;
  trailing?: ReactNode;
  onPress(): void;
}

export function OptionRow({ title, subtitle, selected, showChevron, trailing, onPress }: Props) {
  const c = useThemeColors();
  const { rtl } = useSettings();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: selected ? c.accentSoft : c.surface,
          borderColor: selected ? c.accentBorder : c.border,
          shadowColor: c.shadow,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <View style={styles.texts}>
        <AppText variant="label">{title}</AppText>
        {subtitle ? <AppText variant="caption" muted>{subtitle}</AppText> : null}
      </View>
      {trailing}
      {selected ? <MaterialIcons name="check-circle" size={22} color={c.primary} /> : null}
      {showChevron && !selected ? (
        <MaterialIcons name={rtl ? 'chevron-left' : 'chevron-right'} size={24} color={c.textSoft} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TOUCH + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  texts: { flex: 1, gap: 2 },
});
