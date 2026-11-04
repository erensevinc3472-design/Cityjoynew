import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { HOLIDAY_THEMES, withOpenCountries } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { GlossyIcon } from '@/components/glossy-icon';
import { FilterChip, ListRow, ListSurface, Tag } from '@/components/inner';
import { StateMessage } from '@/components/state-message';
import { TravelHeader } from '@/components/travel-header';
import { useOpenCountries } from '@/lib/holiday';
import { GUTTER, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type Scope = 'tr' | 'abroad';

/** Tema kartlarının renkleri (Seyahat paletinden). */
const THEME_COLORS: Record<string, readonly [string, string]> = {
  deniz: ['#6CB6FA', '#2165C9'],
  kayak: ['#BFE3FF', '#5B8FD6'],
  termal: ['#FFB25C', '#EE6A24'],
  kultur: ['#E2B277', '#A6782F'],
  doga: ['#7FE0A0', '#1F9A5B'],
  lezzet: ['#FF9A8B', '#D9464C'],
  aile: ['#4FDCCB', '#11907F'],
  balayi: ['#F7A1C4', '#C83D7C'],
  'gorulmesi-gereken': ['#D59CF0', '#8B3FC8'],
};

/**
 * Seyahat > Planla = tatil keşfi (PROJE.md 5.2, Eren 3 Kasım 2026; önizleme PL-Giris, PL-Yurtdisi). Türkiye: tatil
 * fikirleri (Deniz, Kayak, Termal…) > o temaya uyan yerler > konaklama > tesis. Yurt dışı: panelden açılan ülkeler;
 * içeriği hazırlanmayan ülke gösterilmez. Yolculuk ücreti hesabı kaldırıldı; Yoldayım ayrı düğmeyle kalır.
 */
export default function PlanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const [scope, setScope] = useState<Scope>('tr');
  const open = useOpenCountries();
  const abroad = withOpenCountries(open ?? null).filter((x) => x.open && x.code !== 'TR');

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar style="light" />
      <TravelHeader subtitle={t('holiday.subtitle')} title={t('holiday.title')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/travel'))} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.seg, { backgroundColor: c.surface, borderColor: c.border }]}>
          <FilterChip label={t('holiday.turkiye')} active={scope === 'tr'} onPress={() => setScope('tr')} />
          <FilterChip label={t('holiday.abroad')} active={scope === 'abroad'} onPress={() => setScope('abroad')} />
        </View>

        {scope === 'tr' ? (
          <>
            <AppText variant="subtitle">{t('holiday.pickTheme')}</AppText>
            <View style={styles.grid}>
              {HOLIDAY_THEMES.map((x) => (
                <Pressable
                  key={x.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${t(`holiday.themes.${x.id}`)}. ${t(`holiday.hints.${x.id}`)}`}
                  onPress={() => router.push({ pathname: '/travel/holiday/[theme]', params: { theme: x.id } })}
                  style={({ pressed }) => [styles.card, { backgroundColor: c.surface, borderColor: c.border, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
                  <GlossyIcon icon={x.icon} colors={THEME_COLORS[x.id] ?? ['#E2B277', '#A6782F']} size={44} />
                  <AppText variant="label" style={{ color: c.textStrong }}>{t(`holiday.themes.${x.id}`)}</AppText>
                  <AppText variant="caption" muted numberOfLines={2}>{t(`holiday.hints.${x.id}`)}</AppText>
                </Pressable>
              ))}
            </View>
            <AppText variant="caption" muted>{t('holiday.note')}</AppText>
          </>
        ) : open === undefined ? (
          <StateMessage kind="loading" />
        ) : !abroad.length ? (
          <StateMessage kind="empty" message={t('holiday.abroadSoon')} />
        ) : (
          <ListSurface>
            {abroad.map((x, n) => (
              <ListRow
                key={x.code}
                first={n === 0}
                leading={<AppText style={styles.flag}>{x.flag}</AppText>}
                title={t(`travel.country.${x.code}`)}
                subtitle={t('holiday.abroadHint')}
                trailing={<Tag label={t('city.soon')} tone="muted" />}
              />
            ))}
          </ListSurface>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: spacing.md, padding: GUTTER, paddingBottom: spacing.xl * 2, width: '100%', maxWidth: 640, alignSelf: 'center' },
  seg: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.pill, borderWidth: 1, alignSelf: 'flex-start' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { width: '48%', flexGrow: 1, gap: spacing.xs, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  flag: { fontSize: 26 },
});
