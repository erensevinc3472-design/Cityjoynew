import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';

/** Formun üstünde ya da altında gösterilen hata / bilgi kutusu. */
export function FormMessage({ kind, text }: { kind: 'error' | 'info'; text: string }) {
  const c = useThemeColors();
  const color = kind === 'error' ? c.danger : c.info;
  return (
    <View
      accessibilityRole={kind === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      style={[styles.box, { backgroundColor: c.surface, borderColor: color }]}>
      <MaterialIcons name={kind === 'error' ? 'error-outline' : 'info-outline'} size={20} color={color} />
      <AppText variant="caption" style={[styles.text, { color: kind === 'error' ? c.danger : c.text }]}>{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  text: { flex: 1 },
});
