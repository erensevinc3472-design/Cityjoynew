import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/app-text';
import { frost, LineTile } from '@/components/city-hub';
import { FrostFill } from '@/components/glass';
import { HeroHeader } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useCityGuideItems, useCityGuideMeta } from '@/lib/city-guide';
import { INSTITUTION_GROUPS } from '@/lib/city-look';
import { useUserLocation } from '@/lib/user-location';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useResolvedScheme, useThemeColors } from '@/theme/use-theme';

/**
 * Önemli Kurumlar (taslak S-Kurumlar): iki sütunlu kutular; her kutuda renkli simge, başlık ve kısa açıklama; dokununca o
 * başlığın kurumları açılır. Bilgisi olmayan başlık soluk ve "Yakında".
 */
export default function InstitutionsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const dark = useResolvedScheme() === 'dark';
  const { location } = useUserLocation();
  const provinceCode = location?.provinceCode;
  const { meta } = useCityGuideMeta(provinceCode);
  const { items, error, retry } = useCityGuideItems(provinceCode, 'onemli-kurumlar');

  const has = (g: (typeof INSTITUTION_GROUPS)[number]) =>
    g.section
      ? (meta?.sections[g.section]?.count ?? 0) > 0
      : !!g.categories && (items ?? []).some((i) => i.category && g.categories!.includes(i.category));

  const header = (
    <HeroHeader serif
      title={t('city.tiles.kurumlar')}
      subtitle={t('city.kurumlarIntro')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/city'))}
    />
  );

  return (
    <Screen warm header={header}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error ? <StateMessage kind="error" message={t('city.loadError')} onRetry={retry} /> : null}
        <View style={styles.grid}>
          {INSTITUTION_GROUPS.map((g) => {
            const on = has(g);
            const title = t(`city.groups.${g.id}.title`);
            const go = () =>
              g.section
                ? router.push({ pathname: '/city/[section]', params: { section: g.section } })
                : router.push({ pathname: '/city/[section]', params: { section: 'onemli-kurumlar', group: g.id } });
            return (
              <Pressable
                key={g.id}
                accessibilityRole="button"
                accessibilityLabel={on ? title : `${title}. ${t('city.soon')}`}
                accessibilityState={{ disabled: !on }}
                disabled={!on}
                onPress={go}
                style={({ pressed }) => [styles.tile, frost(dark, c.surface, c.border), { opacity: on ? 1 : 0.5, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
                <FrostFill />
                <LineTile icon={g.look.icon} gold />

                <View style={styles.flex}>
                  <AppText style={[styles.title, { color: c.textStrong }]} numberOfLines={2}>{title}</AppText>
                  <AppText style={[styles.hint, { color: c.textMuted }]} numberOfLines={2}>
                    {on ? t(`city.groups.${g.id}.hint`) : t('city.soon')}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  // İki sütunlu kutular (taslak S-Kurumlar): simge, ad, kısa açıklama.
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm + 2 },
  tile: { width: '48.5%', minHeight: 124, gap: spacing.sm + 2, padding: spacing.md - 2, borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  flex: { gap: 2 },
  title: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 19 },
  hint: { fontSize: 12, lineHeight: 16 },
});
