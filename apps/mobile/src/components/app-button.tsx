import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { fonts, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';

interface Props {
  title: string;
  onPress(): void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
}

export function AppButton({ title, onPress, variant = 'primary', disabled, loading }: Props) {
  const c = useThemeColors();
  const inactive = disabled || loading;
  const bg = variant === 'primary' ? c.primary : variant === 'secondary' ? c.accentSoft : 'transparent';
  const fg = variant === 'primary' ? c.onPrimary : c.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, opacity: inactive ? 0.5 : pressed ? 0.85 : 1 },
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <AppText style={[styles.label, { color: fg }]}>{title}</AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: fonts.bodySemi, textAlign: 'center' },
});
