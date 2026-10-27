import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { MIN_TOUCH, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';

interface Props {
  checked: boolean;
  onToggle(): void;
  label: string;
  /** Metni okumak için bağlantı (ör. kullanım şartları). */
  linkLabel?: string;
  onLinkPress?(): void;
}

export function CheckboxRow({ checked, onToggle, label, linkLabel, onLinkPress }: Props) {
  const c = useThemeColors();
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        onPress={onToggle}
        hitSlop={4}
        style={styles.box}>
        <MaterialIcons name={checked ? 'check-box' : 'check-box-outline-blank'} size={26} color={checked ? c.accent : c.textMuted} />
      </Pressable>
      <View style={styles.texts}>
        <AppText onPress={onToggle}>{label}</AppText>
        {linkLabel && onLinkPress ? (
          <AppText accessibilityRole="link" onPress={onLinkPress} style={[styles.link, { color: c.accent }]}>
            {linkLabel}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  box: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', marginStart: -spacing.sm, marginTop: -10 },
  texts: { flex: 1, gap: spacing.xs },
  link: { textDecorationLine: 'underline' },
});
