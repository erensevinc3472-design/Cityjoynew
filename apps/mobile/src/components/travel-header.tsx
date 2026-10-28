import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { fonts, GUTTER, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';
import { RoundButton } from './hero-header';

/** Seyahat ekranlarının üst şeridi (tasarım: kesfet-ogren.html): geri, aralıklı "TRAVELJOY" ve altında altın alt başlık. */
export function TravelHeader({ subtitle, title, onBack, right }: { subtitle: string; title?: string; onBack(): void; right?: ReactNode }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.band, { paddingTop: insets.top + spacing.xs, backgroundColor: c.hero, borderBottomColor: c.border }]}>
      <View style={styles.bar}>
        <RoundButton icon="arrow-back" label={t('common.back')} onPress={onBack} />
        <View style={styles.titles}>
          <AppText style={[styles.kicker, { color: c.heroAccent }]} numberOfLines={1}>{subtitle.toLocaleUpperCase()}</AppText>
          <AppText accessibilityRole="header" style={[styles.title, { color: c.heroText }]} numberOfLines={1}>
            {title ?? t('travel.brand').toLocaleUpperCase()}
          </AppText>
        </View>
        {right ?? <View style={styles.spacer} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: { borderBottomWidth: StyleSheet.hairlineWidth },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: GUTTER, minHeight: 54, width: '100%', maxWidth: 640, alignSelf: 'center' },
  titles: { flex: 1 },
  kicker: { fontFamily: fonts.bodySemi, fontSize: 10, letterSpacing: 1.6 },
  title: { fontFamily: fonts.headingSemi, fontSize: 16, lineHeight: 21, letterSpacing: 3 },
  spacer: { width: 40 },
});
