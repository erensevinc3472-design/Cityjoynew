import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DEAL_CATEGORIES, type Deal, type DealCategory } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { useDealEndText } from '@/components/deal-box';
import { HeroHeader } from '@/components/hero-header';
import { FilterRow, Tag } from '@/components/inner';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useProvinceDeals } from '@/lib/deals';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Bir fırsat kategorisinin sayfası (Sosyal Harmoni > Fırsatlar kartından; 13. madde 35). Üstte kategorinin sözü, ilçe
 * filtresi, altında fırsat kartları (Sponsorlu önce, sonra bitişi yakın olan). Karta dokununca işletmenin kendi sayfası
 * açılır, fırsat kutusu orada; geri tuşu bu listeye döner.
 */
export default function DealCategoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { rtl } = useSettings();
  const { category } = useLocalSearchParams<{ category: DealCategory }>();
  const cat: DealCategory = DEAL_CATEGORIES.includes(category) ? category : 'food';
  const { location } = useUserLocation();
  const province = location ? repo.getProvince(location.provinceCode)?.name : undefined;
  const { deals, error, retry } = useProvinceDeals(location?.provinceCode);
  const [district, setDistrict] = useState<string | null>(null);
  const endText = useDealEndText();

  const own = useMemo(() => (deals ?? []).filter((d) => d.category === cat), [deals, cat]);
  const districts = useMemo(() => {
    const ids = [...new Set(own.map((d) => d.districtId).filter((x): x is string => !!x))];
    return ids.map((id) => ({ id, name: repo.getDistrict(id)?.name ?? id })).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [own]);
  const mine = location?.districtId;
  const shown = own
    .filter((d) => !district || d.districtId === district)
    // Sponsorlu sıralaması korunur; aynı grupta kullanıcının ilçesi önce.
    .sort((a, b) => Number(!!b.sponsored) - Number(!!a.sponsored) || Number(b.districtId === mine) - Number(a.districtId === mine));

  const open = (d: Deal) => router.push({ pathname: '/business/[id]', params: { id: d.businessId } });

  return (
    <Screen header={<HeroHeader title={t(`social.deals.${cat}.name`)} subtitle={province} onBack={() => (router.canGoBack() ? router.back() : router.replace('/social'))} />}>
      <FlatList
        data={shown}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.top}>
            <AppText style={[styles.slogan, { color: c.textStrong }]}>{t(`social.deals.${cat}.desc`)}</AppText>
            <FilterRow districts={districts} district={district} onDistrict={setDistrict} />
          </View>
        }
        ListEmptyComponent={
          error ? <StateMessage kind="error" message={t('deals.loadError')} onRetry={retry} />
          : deals === null && location ? <StateMessage kind="loading" />
          : <StateMessage kind="empty" message={t('deals.empty')} />
        }
        ListFooterComponent={<AppText variant="caption" muted style={styles.note}>{t('deals.ownerHint')}</AppText>}
        renderItem={({ item: d }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={[d.sponsored ? t('deals.sponsored') : '', d.businessName, d.value, d.title, endText(d)].filter(Boolean).join(', ')}
            onPress={() => open(d)}
            style={({ pressed }) => [styles.card, { backgroundColor: c.surface, borderColor: d.sponsored ? c.accentBorder : c.border, transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
            <View style={[styles.value, { backgroundColor: c.accentSoft }]}>
              <AppText style={[styles.valueText, { color: c.primary }]} numberOfLines={2} adjustsFontSizeToFit>{d.value}</AppText>
            </View>
            <View style={styles.text}>
              <View style={styles.nameRow}>
                <AppText style={[styles.biz, { color: c.textStrong }]} numberOfLines={1}>{d.businessName}</AppText>
                {d.sponsored ? <Tag label={t('deals.sponsored')} tone="muted" /> : null}
              </View>
              <AppText style={[styles.title, { color: c.textStrong }]} numberOfLines={2}>{d.title}</AppText>
              <AppText style={[styles.meta, { color: c.textMuted }]} numberOfLines={1}>
                {[d.districtId ? repo.getDistrict(d.districtId)?.name : '', endText(d)].filter(Boolean).join(' · ')}
              </AppText>
            </View>
            <MaterialIcons name={rtl ? 'chevron-left' : 'chevron-right'} size={20} color={c.textSoft} />
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm + 2, paddingBottom: spacing.xl },
  top: { gap: spacing.sm + 2, marginBottom: spacing.xs },
  slogan: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 25 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm + 2, borderRadius: radius.xl, borderWidth: 1 },
  value: { width: 72, height: 72, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', padding: 6 },
  valueText: { fontFamily: fonts.heading, fontSize: 19, lineHeight: 23, textAlign: 'center' },
  text: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  biz: { flexShrink: 1, fontFamily: fonts.bodySemi, fontSize: 13, opacity: 0.85 },
  title: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 20 },
  meta: { fontSize: 12.5 },
  note: { textAlign: 'center', paddingTop: spacing.md },
});
