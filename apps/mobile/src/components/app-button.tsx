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
  // Ana: altın zemin; ikincil: kart zemini + altın kenarlık; metin: yalnızca altın yazı.
  const bg = variant === 'primary' ? c.primary : variant === 'secondary' ? c.surface : 'transparent';
  const fg = variant === 'primary' ? c.onPrimary : c.primary;
  const borderColor = variant === 'secondary' ? c.border : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, borderColor, opacity: inactive ? 0.5 : pressed ? 0.85 : 1 },
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
    borderWidth: 1,
  },
  label: { fontFamily: fonts.headingSemi, textAlign: 'center', letterSpacing: 0.2 },
});
