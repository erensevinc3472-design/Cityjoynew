import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { FEED_SORTS } from '@cityjoy/shared';

import { setFeedSort, useFeedSort } from '@/lib/feed-sort';
import { fonts, GUTTER, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';

/**
 * Keşfet üst çubuğunda menünün yanındaki küçük "Senin için ⌄" düğmesi (Eren, 12 Kasım 2026: "çok göze batmasın, ufak
 * bir buton olsun, basınca seçim yapılsın"). Alttan açılan küçük pencerede iki seçenek ve "Nasıl sıralanıyor?".
 */
export function FeedSortButton() {
  const { t } = useTranslation();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const sort = useFeedSort();
  const [open, setOpen] = useState(false);
  const [how, setHow] = useState(false);
  const close = () => {
    setOpen(false);
    setHow(false);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('explore.sort.label')}: ${t(`explore.sort.${sort}`)}`}
        onPress={() => setOpen(true)}
        hitSlop={6}
        style={({ pressed }) => [styles.pill, { backgroundColor: c.heroChip, opacity: pressed ? 0.7 : 1 }]}>
        <AppText numberOfLines={1} style={[styles.pillText, { color: c.heroText }]}>{t(`explore.sort.${sort}`)}</AppText>
        <MaterialIcons name="expand-more" size={16} color={c.heroMuted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <View style={styles.root}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={close} style={[StyleSheet.absoluteFill, styles.backdrop]} />
          <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + spacing.md }]} accessibilityViewIsModal>
            <View style={[styles.grabber, { backgroundColor: c.border }]} />
            <AppText accessibilityRole="header" style={[styles.title, { color: c.textStrong }]}>{t('explore.sort.choose')}</AppText>
            {FEED_SORTS.map((s) => {
              const on = s === sort;
              return (
                <Pressable
                  key={s}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    setFeedSort(s);
                    close();
                  }}
                  style={({ pressed }) => [styles.option, { borderColor: on ? c.accentBorder : c.border, backgroundColor: on ? c.accentSoft : 'transparent', opacity: pressed ? 0.75 : 1 }]}>
                  <MaterialIcons name={s === 'senin-icin' ? 'auto-awesome' : 'schedule'} size={20} color={on ? c.accent : c.textMuted} />
                  <View style={styles.flex}>
                    <AppText style={[styles.optTitle, { color: c.textStrong }]}>{t(`explore.sort.${s}`)}</AppText>
                    <AppText style={[styles.optDesc, { color: c.textMuted }]}>{t(s === 'senin-icin' ? 'explore.sort.seninDesc' : 'explore.sort.yeniDesc')}</AppText>
                  </View>
                  {on ? <MaterialIcons name="check" size={20} color={c.accent} /> : null}
                </Pressable>
              );
            })}
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: how }} onPress={() => setHow((v) => !v)} style={styles.how} hitSlop={4}>
              <MaterialIcons name="info-outline" size={16} color={c.textMuted} />
              <AppText style={[styles.howText, { color: c.textMuted }]}>{t('explore.sort.how')}</AppText>
              <MaterialIcons name={how ? 'expand-less' : 'expand-more'} size={16} color={c.textMuted} />
            </Pressable>
            {how ? <AppText style={[styles.rules, { color: c.textMuted }]}>{t('explore.sort.rules')}</AppText> : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 32, paddingStart: 10, paddingEnd: 6, borderRadius: radius.pill, maxWidth: 120 },
  pillText: { flexShrink: 1, fontFamily: fonts.bodySemi, fontSize: 12.5 },
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: GUTTER, paddingTop: spacing.sm, gap: spacing.sm },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: spacing.xs },
  title: { fontFamily: fonts.headingSemi, fontSize: 16, textAlign: 'center', marginBottom: spacing.xs },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 60, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1 },
  optTitle: { fontFamily: fonts.bodySemi, fontSize: 15 },
  optDesc: { fontSize: 13, marginTop: 2 },
  how: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, alignSelf: 'flex-start' },
  howText: { fontSize: 13 },
  rules: { fontSize: 13, lineHeight: 19 },
});
