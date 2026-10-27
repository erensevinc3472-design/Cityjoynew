import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useThemeColors } from '@/theme/use-theme';

/** Yıldız gösterimi; onChange verilirse seçilebilir (her yıldız ayrı düğme, ekran okuyucuya "3 yıldız"). */
export function Stars({ value, size = 18, onChange }: { value: number; size?: number; onChange?(v: number): void }) {
  const c = useThemeColors();
  const { t } = useTranslation();
  return (
    <View
      style={styles.row}
      accessible={!onChange}
      accessibilityLabel={onChange ? undefined : t('reviews.star', { count: value })}
      accessibilityRole={onChange ? 'radiogroup' : undefined}>
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = <MaterialIcons name={n <= value ? 'star' : 'star-border'} size={size} color={n <= value ? c.highlight : c.textSoft} />;
        return onChange ? (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityState={{ checked: n === value }}
            accessibilityLabel={t('reviews.star', { count: n })}
            hitSlop={4}
            onPress={() => onChange(n)}
            style={styles.touch}>
            {icon}
          </Pressable>
        ) : (
          <View key={n}>{icon}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  touch: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
