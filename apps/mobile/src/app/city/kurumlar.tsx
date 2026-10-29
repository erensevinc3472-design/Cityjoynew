import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/app-text';
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
 * Önemli Kurumlar (tasarım: onemli-kurumlar.html): tek, toplu liste. Her satırda renkli çerçeveli simge, başlık, kısa
 * açıklama ve altın ok; dokununca o başlığın kurumları açılır. Bilgisi olmayan başlık soluk ve "Yakında".
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

  const has = (g: (typeof INSTITUTION_GROUPS)[number]) =>
    g.section
      ? (meta?.sections[g.section]?.count ?? 0) > 0
      : !!g.categories && (items ?? []).some((i) => i.category && g.categories!.includes(i.category));

  const header = (
    <HeroHeader
      title={t('city.tiles.kurumlar')}
      subtitle={t('city.kurumlarIntro')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/city'))}
    />
  );

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error ? <StateMessage kind="error" message={t('city.loadError')} onRetry={retry} /> : null}
        {INSTITUTION_GROUPS.map((g) => {
          const on = has(g);
          const title = t(`city.groups.${g.id}.title`);
          const color = g.look.colors[0];
          const go = () =>
            g.section
              ? router.push({ pathname: '/city/[section]', params: { section: g.section } })
              : router.push({ pathname: '/city/[section]', params: { section: 'onemli-kurumlar', group: g.id } });
          return (
            <Pressable
              key={g.id}
              accessibilityRole="button"
              accessibilityLabel={on ? title : `${title}. ${t('city.soon')}`}
              disabled={!on}
              onPress={go}
              style={({ pressed }) => [styles.row, { backgroundColor: c.surface, borderColor: c.border, opacity: on ? 1 : 0.5, transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
              <View style={[styles.icon, { backgroundColor: `${color}1F`, borderColor: `${color}40` }]}>
                <MaterialIcons name={g.look.icon} size={26} color={color} />
              </View>
              <View style={styles.flex}>
                <AppText style={[styles.title, { color: c.textStrong }]}>{title}</AppText>
                <AppText style={[styles.hint, { color: c.textMuted }]} numberOfLines={1}>
                  {on ? t(`city.groups.${g.id}.hint`) : t('city.soon')}
                </AppText>
              </View>
              <MaterialIcons name={rtl ? 'arrow-back' : 'arrow-forward'} size={22} color={c.accent} />
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  flex: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md + 2, paddingHorizontal: spacing.md, borderRadius: radius.xl, borderWidth: 1 },
  icon: { width: 50, height: 50, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 22 },
  hint: { fontSize: 13, lineHeight: 18 },
});
