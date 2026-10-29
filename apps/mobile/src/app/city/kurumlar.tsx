import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/app-text';
import { GlossyIcon } from '@/components/glossy-icon';
import { HeroHeader } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useCityGuideItems, useCityGuideMeta } from '@/lib/city-guide';
import { INSTITUTION_GROUPS } from '@/lib/city-look';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Önemli Kurumlar (tasarım: onemli-kurumlar.html): alt başlıklar listesi (muhtarlıklar, kamu kurumları, hastaneler,
 * emniyet, itfaiye, nüfus, noter, PTT, vergi, SGK, eğitim, toplanma alanları). Sayı bilgiden gelir; bilgisi olmayan
 * başlık soluk ve "Yakında". Nöbetçi eczane Benim Şehrim'de ayrı kutuda.
 */
export default function InstitutionsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { rtl } = useSettings();
  const { location } = useUserLocation();
  const provinceCode = location?.provinceCode;
  const { meta } = useCityGuideMeta(provinceCode);
  const { items, error, retry } = useCityGuideItems(provinceCode, 'onemli-kurumlar');

  const countOf = (g: (typeof INSTITUTION_GROUPS)[number]) =>
    g.section ? (meta?.sections[g.section]?.count ?? 0) : (items ?? []).filter((i) => i.category && g.categories!.includes(i.category)).length;

  return (
    <Screen header={<HeroHeader title={t('city.tiles.kurumlar')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/city'))} />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppText style={[styles.intro, { color: c.textMuted }]}>{t('city.kurumlarIntro')}</AppText>
        {error ? <StateMessage kind="error" message={t('city.loadError')} onRetry={retry} /> : items === null && !!meta?.sections['onemli-kurumlar'] ? <StateMessage kind="loading" /> : null}
        {INSTITUTION_GROUPS.map((g) => {
          const n = countOf(g);
          const on = n > 0;
          const title = t(`city.groups.${g.id}.title`);
          const go = () =>
            g.section
              ? router.push({ pathname: '/city/[section]', params: { section: g.section } })
              : router.push({ pathname: '/city/[section]', params: { section: 'onemli-kurumlar', group: g.id } });
          return (
            <Pressable
              key={g.id}
              accessibilityRole="button"
              accessibilityLabel={on ? `${title}. ${t('city.count', { count: n })}` : `${title}. ${t('city.soon')}`}
              disabled={!on}
              onPress={go}
              style={({ pressed }) => [styles.row, { backgroundColor: c.surface, borderColor: c.border, transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
              <GlossyIcon icon={g.look.icon} colors={g.look.colors} size={48} dim={!on} />
              <View style={styles.flex}>
                <AppText style={[styles.title, { color: on ? c.textStrong : c.textSoft }]}>{title}</AppText>
                <AppText style={[styles.hint, { color: c.textMuted }]} numberOfLines={1}>{t(`city.groups.${g.id}.hint`)}</AppText>
              </View>
              {on ? (
                <AppText style={[styles.count, { color: c.accent }]}>{n}</AppText>
              ) : (
                <AppText style={[styles.soon, { color: c.textSoft }]}>{t('city.soon')}</AppText>
              )}
              <MaterialIcons name={rtl ? 'arrow-back' : 'arrow-forward'} size={20} color={on ? c.textMuted : c.textSoft} />
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm + 2, paddingBottom: spacing.xl },
  intro: { fontSize: 13, lineHeight: 18 },
  flex: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.xl, borderWidth: 1 },
  title: { fontFamily: fonts.heading, fontSize: 16, lineHeight: 21 },
  hint: { fontSize: 12, lineHeight: 16 },
  count: { fontFamily: fonts.display, fontSize: 16 },
  soon: { fontSize: 10 },
});
