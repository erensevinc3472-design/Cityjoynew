import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { HOLIDAY_THEMES, isHolidayTheme, roadKm, type HolidayPlace } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { ListRow, ListSurface, RowIcon, Tag } from '@/components/inner';
import { StateMessage } from '@/components/state-message';
import { TravelHeader } from '@/components/travel-header';
import { priceRange, useHolidayTheme } from '@/lib/holiday';
import { locationRepository as repo } from '@/lib/locations';
import { useUserLocation } from '@/lib/user-location';
import { GUTTER, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Tatil fikri > yerler (önizleme PL-Tema). Yerler, o temayla etiketlenmiş doğrulanmış tesislerden çıkar; ekip panelde
 * sırayı, sezonu ve kısa notu düzenler, uymayanı gizler. Uzaklık kullanıcının ilinden yol tahminidir.
 */
export default function HolidayThemeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { theme: raw } = useLocalSearchParams<{ theme: string }>();
  const theme = isHolidayTheme(raw) ? raw : 'deniz';
  const meta = HOLIDAY_THEMES.find((x) => x.id === theme)!;
  const { location } = useUserLocation();
  const { value, failed, reload } = useHolidayTheme(theme);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/travel/planla'));

  const meta2 = (p: HolidayPlace) => {
    const parts: string[] = [];
    if (location?.provinceCode && location.provinceCode !== p.provinceCode) {
      parts.push(t('holiday.km', { km: Math.round(roadKm(location.provinceCode, p.provinceCode)).toLocaleString(i18n.language) }));
    }
    if (p.season) parts.push(p.season);
    parts.push(t('holiday.stays', { count: p.count }));
    return parts.join(' · ');
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar style="light" />
      <TravelHeader subtitle={t('holiday.title')} title={t(`holiday.themes.${theme}`)} onBack={back} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppText style={{ color: c.textMuted }}>{t(`holiday.hints.${theme}`)}</AppText>
        {failed ? (
          <StateMessage kind="error" onRetry={reload} />
        ) : !value ? (
          <StateMessage kind="loading" />
        ) : !value.places.length ? (
          <StateMessage kind="empty" message={t('holiday.noPlaces')} />
        ) : (
          <ListSurface>
            {value.places.map((p, n) => {
              const price = priceRange(p.nightMin, p.nightMax, i18n.language);
              return (
                <ListRow
                  key={p.provinceCode}
                  first={n === 0}
                  leading={<RowIcon icon={meta.icon} tint={c.accent} />}
                  title={repo.getProvince(p.provinceCode)?.name ?? p.provinceCode}
                  subtitle={[meta2(p), p.note].filter(Boolean).join('\n')}
                  trailing={price ? <Tag label={t('holiday.from', { price })} /> : undefined}
                  onPress={() => router.push({ pathname: '/travel/stay', params: { province: p.provinceCode, theme } })}
                />
              );
            })}
          </ListSurface>
        )}
        <AppText variant="caption" muted>{t('holiday.placesNote')}</AppText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: spacing.md, padding: GUTTER, paddingBottom: spacing.xl * 2, width: '100%', maxWidth: 640, alignSelf: 'center' },
});
