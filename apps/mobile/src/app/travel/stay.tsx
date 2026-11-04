import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { isFeatured, isHolidayTheme, isLodgingKind, LODGING_KINDS, type Business } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { ListRow, ListSurface, RowIcon, SectionTitle, Tag } from '@/components/inner';
import { StateMessage } from '@/components/state-message';
import { TravelHeader } from '@/components/travel-header';
import { priceRange, useStays } from '@/lib/holiday';
import { locationRepository as repo } from '@/lib/locations';
import { GUTTER, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/** Reklamlı tesis en çok bu kadar başa alınır (önizleme PL-Konaklama). */
const MAX_ADS = 2;

/**
 * Yer > konaklama (önizleme PL-Konaklama): üstte "Şehri tanı" kartı (TravelJoy şehir sayfası), altta o ildeki doğrulanmış
 * tesisler. Rezervasyon uygulamada yok; tesis sayfasından telefon ya da kendi sitesiyle doğrudan yapılır.
 */
export default function StayScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const params = useLocalSearchParams<{ province: string; theme?: string }>();
  const code = String(params.province ?? '');
  const theme = params.theme && isHolidayTheme(params.theme) ? params.theme : undefined;
  const name = repo.getProvince(code)?.name ?? code;
  const { value, failed, reload } = useStays(code, theme);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/travel/planla'));

  const now = new Date();
  const ads = (value ?? []).filter((b) => isFeatured(b, now)).slice(0, MAX_ADS);
  const list = [...ads, ...(value ?? []).filter((b) => !ads.includes(b))];

  const subtitle = (b: Business) => {
    const kind = b.categoryIds.find(isLodgingKind);
    const district = repo.getDistrict(b.location.districtId)?.name;
    return [kind ? t(`lodging.kinds.${kind}`) : undefined, district].filter(Boolean).join(' · ');
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar style="light" />
      <TravelHeader subtitle={theme ? t(`holiday.themes.${theme}`) : t('holiday.title')} title={name} onBack={back} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ListSurface>
          <ListRow
            first
            leading={<RowIcon icon="travel-explore" tint={c.accent} />}
            title={t('holiday.knowCity', { name })}
            subtitle={t('holiday.knowCityHint')}
            onPress={() => router.push({ pathname: '/travel/city/[code]', params: { code } })}
          />
        </ListSurface>

        <SectionTitle title={t('holiday.staysTitle')} />
        {failed ? (
          <StateMessage kind="error" onRetry={reload} />
        ) : !value ? (
          <StateMessage kind="loading" />
        ) : !list.length ? (
          <StateMessage kind="empty" message={t('holiday.noStays')} />
        ) : (
          <ListSurface>
            {list.map((b, n) => {
              const kind = b.categoryIds.find(isLodgingKind);
              const price = priceRange(b.lodging?.nightMin, b.lodging?.nightMax, i18n.language);
              return (
                <ListRow
                  key={b.id}
                  first={n === 0}
                  leading={<RowIcon icon={LODGING_KINDS.find((k) => k.id === kind)?.icon ?? 'hotel'} tint={c.accent} />}
                  title={b.name}
                  subtitle={[subtitle(b), price ? t('lodging.perNight', { price }) : undefined].filter(Boolean).join('\n')}
                  trailing={ads.includes(b) ? <Tag label={t('holiday.ad')} tone="muted" /> : undefined}
                  onPress={() => router.push({ pathname: '/business/[id]', params: { id: b.id } })}
                />
              );
            })}
          </ListSurface>
        )}
        <AppText variant="caption" muted>{t('lodging.bookDirect')}</AppText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: spacing.md, padding: GUTTER, paddingBottom: spacing.xl * 2, width: '100%', maxWidth: 640, alignSelf: 'center' },
});
