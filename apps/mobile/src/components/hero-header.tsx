import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps, PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useSettings } from '@/lib/settings';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

export interface HeaderAction {
  icon: IconName;
  label: string;
  onPress(): void;
  /** Okunmamış bir şey varsa küçük nokta (ör. bildirim zili). */
  badge?: boolean;
}

interface Props {
  title?: string;
  /** Başlığın altında küçük açıklama (ör. "Bursa › Nilüfer"). */
  subtitle?: string;
  onBack?(): void;
  /** Geri düğmesi yoksa soldaki işlem (ör. ana sayfada yan menü). */
  left?: HeaderAction;
  /** Sağdaki işlem; iki işlem de olabilir (ör. Keşfet: Mesajlar ve yeni gönderi). */
  right?: HeaderAction | HeaderAction[];
}

/** Üst bant: geri düğmesi, ortada başlık, sağda işlem; altında isteğe bağlı içerik (konum çipi vb.). */
export function HeroHeader({ title, subtitle, onBack, left, right, children }: PropsWithChildren<Props>) {
  const c = useThemeColors();
  const { rtl } = useSettings();
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        {onBack ? (
          <RoundButton icon={rtl ? 'arrow-forward' : 'arrow-back'} label={t('common.back')} onPress={onBack} />
        ) : left ? (
          <RoundButton {...left} />
        ) : (
          <View style={styles.spacer} />
        )}
        {title ? (
          <AppText accessibilityRole="header" numberOfLines={1} style={[styles.title, { color: c.heroText }]}>{title}</AppText>
        ) : (
          <View style={styles.flex} />
        )}
        {Array.isArray(right) ? (
          <View style={styles.row}>
            {right.map((r) => (
              <RoundButton key={r.label} {...r} />
            ))}
          </View>
        ) : right ? (
          <RoundButton {...right} />
        ) : (
          <View style={styles.spacer} />
        )}
      </View>
      {subtitle ? <AppText style={[styles.subtitle, { color: c.heroMuted }]}>{subtitle}</AppText> : null}
      {children}
    </View>
  );
}

export function RoundButton({ icon, label, onPress, badge }: HeaderAction) {
  const c = useThemeColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4} style={({ pressed }) => [styles.round, { backgroundColor: c.heroChip, opacity: pressed ? 0.7 : 1 }]}>
      <MaterialIcons name={icon} size={21} color={c.heroText} />
      {badge ? <View style={[styles.badge, { backgroundColor: c.heroAccent, borderColor: c.heroChip }]} /> : null}
    </Pressable>
  );
}

/** Üst banttaki konum çipi. */
export function LocationChip({ label, onPress }: { label: string; onPress(): void }) {
  const c = useThemeColors();
  const { t } = useTranslation();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}. ${t('home.changeLocation')}`} onPress={onPress} style={({ pressed }) => [styles.chip, { backgroundColor: c.heroChip, opacity: pressed ? 0.7 : 1 }]}>
      <MaterialIcons name="place" size={18} color={c.heroAccent} />
      <AppText numberOfLines={1} style={[styles.chipText, { color: c.heroText }]}>{label}</AppText>
      <MaterialIcons name="expand-more" size={20} color={c.heroText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 40 },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.heading, fontSize: 17, lineHeight: 24 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: -spacing.xs },
  spacer: { width: 40 },
  badge: { position: 'absolute', top: 7, right: 7, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
  row: { flexDirection: 'row', gap: spacing.xs },
  flex: { flex: 1 },
  round: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', maxWidth: '100%', minHeight: 34, paddingHorizontal: 12, borderRadius: radius.pill },
  chipText: { flexShrink: 1, fontFamily: fonts.bodySemi, fontSize: 13 },
});
