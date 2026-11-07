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
  /** Eski ortalı küçük başlık (yalnızca ana sekmelerde). İç ekranlar büyük altın başlığı kullanır (13. madde 35). */
  compact?: boolean;
  /** Büyük başlık tırnaklı yazıyla (Benim Şehrim alt sayfaları). */
  serif?: boolean;
}

/**
 * Üst bant: geri düğmesi ve sağda işlemler; altında sola yaslı büyük altın başlık ve konum / açıklama (iç ekranların
 * ortak dili, 13. madde 35); en altta isteğe bağlı içerik (konum çipi, filtre satırı vb.).
 */
export function HeroHeader({ title, subtitle, onBack, left, right, compact, serif, children }: PropsWithChildren<Props>) {
  const c = useThemeColors();
  const { rtl } = useSettings();
  const { t } = useTranslation();
  const large = !!title && !compact;
  if (serif && title) {
    // Cam taslağı: geri düğmesi, yanında beyaz tırnaklı başlık ve altında konum / sayı.
    return (
      <View style={styles.wrap}>
        <View style={styles.top}>
          {onBack ? <RoundButton icon={rtl ? 'arrow-forward' : 'arrow-back'} label={t('common.back')} onPress={onBack} /> : null}
          <View style={styles.flex}>
            <AppText accessibilityRole="header" numberOfLines={2} style={[styles.serif, { color: c.heroText }]}>{title}</AppText>
            {subtitle ? <AppText numberOfLines={1} style={[styles.bigSub, { color: c.heroMuted }]}>{subtitle}</AppText> : null}
          </View>
          {Array.isArray(right) ? (
            <View style={styles.row}>
              {right.map((r) => (
                <RoundButton key={r.label} {...r} />
              ))}
            </View>
          ) : right ? (
            <RoundButton {...right} />
          ) : null}
        </View>
        {children}
      </View>
    );
  }
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
        {title && !large ? (
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
      {large ? (
        <View style={styles.big}>
          <AppText accessibilityRole="header" style={[styles.bigTitle, { color: c.heroAccent }]}>{title}</AppText>
          {subtitle ? <AppText style={[styles.bigSub, { color: c.heroMuted }]}>{subtitle}</AppText> : null}
        </View>
      ) : subtitle ? (
        <AppText style={[styles.subtitle, { color: c.heroMuted }]}>{subtitle}</AppText>
      ) : null}
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
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.heading, fontSize: 16, lineHeight: 22 },
  subtitle: { fontSize: 13, lineHeight: 18, marginTop: -spacing.xs },
  big: { gap: 2, marginTop: -spacing.xs },
  bigTitle: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  serif: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 31 },
  bigSub: { fontSize: 13, lineHeight: 18 },
  spacer: { width: 40 },
  badge: { position: 'absolute', top: 7, right: 7, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
  row: { flexDirection: 'row', gap: spacing.xs },
  flex: { flex: 1 },
  round: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', maxWidth: '100%', minHeight: 34, paddingHorizontal: 12, borderRadius: radius.pill },
  chipText: { flexShrink: 1, fontFamily: fonts.bodySemi, fontSize: 13 },
});
