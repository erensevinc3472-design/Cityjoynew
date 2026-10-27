import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { cityChoiceLabel, citySection, normalizeName, type CityGuideItem, type CityGuideSectionId } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { HeroHeader } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { StateMessage } from '@/components/state-message';
import { useCityGuideItems } from '@/lib/city-guide';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/** Kartta adın altındaki kısa bilgi: bölüme göre en işe yarayan alan. */
const SUMMARY_KEYS = ['calisma_hafta_ici', 'acilis_saatleri', 'gunler', 'ilk_saat_tl', 'ucret_durumu', 'hat_kodu', 'calisma_saatleri', 'kisa_metin', 'aciklama'];

/** Bir Benim Şehrim bölümünün listesi: arama ve ilçe süzgeci; kullanıcının ilçesi önce gelir. */
export default function CitySectionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { section } = useLocalSearchParams<{ section: CityGuideSectionId }>();
  const def = citySection(section);
  const { language, rtl } = useSettings();
  const lang = language ?? 'tr';
  const { location } = useUserLocation();
  const { items, stale, error, retry } = useCityGuideItems(location?.provinceCode, section);
  const [query, setQuery] = useState('');
  const [district, setDistrict] = useState<string | null>(null);

  const districts = useMemo(() => {
    const ids = [...new Set((items ?? []).map((i) => i.districtId).filter((x): x is string => !!x))];
    return ids.map((id) => ({ id, name: repo.getDistrict(id)?.name ?? id })).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [items]);

  const shown = useMemo(() => {
    const q = normalizeName(query);
    const mine = location?.districtId;
    return (items ?? [])
      .filter((i) => !district || i.districtId === district)
      .filter((i) => !q || normalizeName(`${i.name} ${i.category ? cityChoiceLabel(i.category, lang) : ''} ${repo.getDistrict(i.districtId ?? '')?.name ?? ''}`).includes(q))
      .sort((a, b) => Number(b.districtId === mine) - Number(a.districtId === mine) || a.name.localeCompare(b.name, 'tr'));
  }, [items, query, district, location?.districtId, lang]);

  const summary = (i: CityGuideItem) => {
    const key = SUMMARY_KEYS.find((k) => i.values[k] !== undefined);
    if (!key) return '';
    const v = i.values[key];
    if (key === 'ilk_saat_tl') return t('city.firstHour', { price: v });
    if (key === 'ucret_durumu') return cityChoiceLabel(String(v), lang);
    return Array.isArray(v) ? v.join(', ') : String(v);
  };

  const header = (
    <HeroHeader
      title={def ? (def.names[lang] ?? def.names.tr) : ''}
      subtitle={location ? repo.getProvince(location.provinceCode)?.name : undefined}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/city'))}
    />
  );

  const chip = (id: string | null, label: string) => {
    const active = district === id;
    return (
      <Pressable
        key={id ?? 'all'}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={() => setDistrict(id)}
        style={[styles.chip, { backgroundColor: active ? c.primary : c.surface, borderColor: active ? c.primary : c.border }]}>
        <AppText variant="caption" style={{ color: active ? c.onPrimary : c.text }}>{label}</AppText>
      </Pressable>
    );
  };

  return (
    <Screen header={header}>
      <FlatList
        data={shown}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.top}>
            <SearchField value={query} onChangeText={setQuery} placeholder={t('city.search')} />
            {districts.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {chip(null, t('city.allDistricts'))}
                {districts.map((d) => chip(d.id, d.name))}
              </ScrollView>
            ) : null}
            {stale ? <AppText variant="caption" muted>{t('city.staleNote')}</AppText> : null}
            {lang !== 'tr' ? <AppText variant="caption" muted>{t('city.contentLanguage')}</AppText> : null}
          </View>
        }
        ListEmptyComponent={
          error ? <StateMessage kind="error" message={t('city.loadError')} onRetry={retry} /> : items === null ? <StateMessage kind="loading" /> : <StateMessage kind="empty" message={items.length ? t('common.noResults') : t('city.empty')} />
        }
        renderItem={({ item: i }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={[i.name, i.verified ? '' : t('city.unverified')].filter(Boolean).join(', ')}
            onPress={() => router.push({ pathname: '/city/item', params: { section, id: i.id } })}
            style={({ pressed }) => [styles.card, { backgroundColor: c.surface, borderColor: c.border, shadowColor: c.shadow, opacity: pressed ? 0.85 : 1 }]}>
            <View style={styles.flex}>
              <AppText variant="label">{i.name}</AppText>
              <AppText variant="caption" muted numberOfLines={1}>
                {[i.category ? cityChoiceLabel(i.category, lang) : '', i.districtId ? repo.getDistrict(i.districtId)?.name : ''].filter(Boolean).join(' · ')}
              </AppText>
              {summary(i) ? <AppText variant="caption" numberOfLines={2}>{summary(i)}</AppText> : null}
              {i.verified ? null : (
                <View style={[styles.badge, { backgroundColor: c.dangerSoft }]}>
                  <AppText variant="caption" style={{ color: c.danger }}>{t('city.unverified')}</AppText>
                </View>
              )}
            </View>
            <MaterialIcons name={rtl ? 'chevron-left' : 'chevron-right'} size={22} color={c.textSoft} />
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm, paddingBottom: spacing.xl },
  top: { gap: spacing.sm, marginBottom: spacing.xs },
  chips: { gap: spacing.xs, paddingVertical: 2 },
  chip: { minHeight: MIN_TOUCH - 8, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  flex: { flex: 1, gap: 4 },
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
});
