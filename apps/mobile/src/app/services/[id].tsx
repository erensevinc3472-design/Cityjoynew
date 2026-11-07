import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { findCategory, localized, openState, rankBusinesses, type Business, type RankedBusinesses } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { BusinessCard } from '@/components/business-card';
import { HeroHeader } from '@/components/hero-header';
import { FilterChip, FilterRow } from '@/components/inner';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { StateMessage } from '@/components/state-message';
import { TaxiStands } from '@/components/taxi-stands';
import { locationRepository } from '@/lib/locations';
import { useServiceCategories } from '@/lib/service-categories';
import { businessRepository } from '@/lib/services';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * Kategoriye göre değişen üst uyarı (13. madde 35: "çekici sayfası gibi"; kategoriye göre yalnızca uyarı, arama ipucu ve
 * filtreler değişir). Anahtar kategori ya da üst kategori kimliği; `call` uyarıdaki numara (ör. gaz kokusunda 187).
 */
const PROFILES: Record<string, { key: string; call?: string }> = {
  'acil-veteriner': { key: 'veteriner' },
  cekici: { key: 'yol' },
  'yol-yardim': { key: 'yol' },
  'oto-kurtarma': { key: 'yol' },
  cilingir: { key: 'cilingir' },
  'dogalgaz-servisi': { key: 'dogalgaz', call: '187' },
  elektrikci: { key: 'elektrik' },
  tesisatci: { key: 'tesisat' },
  'ozel-ambulans': { key: 'ambulans', call: '112' },
  taksi: { key: 'taksi' },
  sigorta: { key: 'sigorta' },
  'tamirat-tadilat': { key: 'tamirat' },
};

/**
 * Bir hizmetin işletme listesi, kullanıcının ilinde. Sıralama herkes için aynı kural (Karar, Eren;
 * PROJE.md 5.6): en çok 2 "Reklam" kartı, sonra doğrulanmış, puan, ilçe, güncellik. Acil kategoride
 * 112 hatırlatması üstte durur. Liste içinde arama, ilçe, "Şu an açık" ve "Doğrulanmış" filtreleri; Taksi'de
 * üstte taksi durakları.
 */
export default function ServiceCategoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const { location } = useUserLocation();
  const { all } = useServiceCategories();
  const category = findCategory(all, id);
  const parent = category?.parentId ? findCategory(all, category.parentId) : undefined;
  const province = location ? locationRepository.getProvince(location.provinceCode)?.name : undefined;
  const subtitle = [parent && localized(parent.names, lang), province].filter(Boolean).join(' · ');
  const name = category ? localized(category.names, lang) : t('services.title');
  const profile = PROFILES[id] ?? (category?.parentId ? PROFILES[category.parentId] : undefined);

  const [ranked, setRanked] = useState<RankedBusinesses | null>(null);
  const [error, setError] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [query, setQuery] = useState('');
  const [district, setDistrict] = useState<string | null>(null);
  const [openNow, setOpenNow] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const provinceCode = location?.provinceCode;
  const districtId = location?.districtId;
  const load = useCallback(() => {
    if (!provinceCode) return;
    setError(false);
    setRanked(null);
    businessRepository
      .listByCategory(provinceCode, id)
      .then((list) => setRanked(rankBusinesses(list, { districtId })))
      .catch(() => setError(true));
  }, [id, provinceCode, districtId]);

  useEffect(load, [load]);

  const everyone = useMemo(() => (ranked ? [...ranked.featured, ...ranked.others] : []), [ranked]);
  const districts = useMemo(() => {
    const ids = [...new Set(everyone.map((b) => b.location.districtId).filter((x): x is string => !!x))];
    return ids.map((d) => ({ id: d, name: locationRepository.getDistrict(d)?.name ?? d })).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [everyone]);
  const q = query.trim().toLocaleLowerCase('tr');
  const now = new Date();
  const keep = (b: Business) =>
    (!district || b.location.districtId === district) &&
    (!verifiedOnly || b.verification.status === 'dogrulandi') &&
    (!openNow || !!openState(b, now)?.open) &&
    (!q || `${b.name} ${b.description ?? ''} ${locationRepository.getDistrict(b.location.districtId ?? '')?.name ?? ''}`.toLocaleLowerCase('tr').includes(q));
  const featured = ranked ? ranked.featured.filter(keep) : [];
  const others = ranked ? ranked.others.filter(keep) : [];
  const total = everyone.length;
  const filtered = !!q || !!district || openNow || verifiedOnly;
  // Doğrulanmamışlar ayrı bölümde, başında uyarıyla (Karar Eren, 7 Kasım).
  const verifiedOthers = others.filter((b) => b.verification.status === 'dogrulandi');
  const unverified = others.filter((b) => b.verification.status !== 'dogrulandi');

  const header = (
    <HeroHeader title={name} subtitle={subtitle || undefined} onBack={() => (router.canGoBack() ? router.back() : router.replace('/services'))} />
  );

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {category?.urgent || profile ? (
          <View style={[styles.warning, category?.urgent ? { backgroundColor: c.dangerSoft, borderColor: c.danger } : { backgroundColor: c.accentSoft, borderColor: c.accentBorder }]}>
            <MaterialIcons name={(category?.urgent ? 'warning-amber' : 'info-outline') as IconName} size={22} color={category?.urgent ? c.danger : c.primary} />
            <View style={styles.flex}>
              <AppText variant="caption">{profile ? t(`services.profiles.${profile.key}`) : t('services.urgentNote')}</AppText>
              {profile?.call ? (
                <AppText accessibilityRole="link" onPress={() => Linking.openURL(`tel:${profile.call}`).catch(() => {})} style={[styles.callLink, { color: c.danger }]}>
                  {t('services.callNumber', { number: profile.call })}
                </AppText>
              ) : null}
            </View>
          </View>
        ) : null}
        {category?.urgent ? <AppButton variant="secondary" title={t('services.emergencyNumbers')} onPress={() => router.push('/urgent')} /> : null}
        {id === 'taksi' && location ? <TaxiStands provinceCode={location.provinceCode} districtId={location.districtId} /> : null}

        {total > 0 ? (
          <>
            {total > 3 ? <SearchField value={query} onChangeText={setQuery} placeholder={t('services.searchIn', { name })} /> : null}
            <FilterRow
              districts={districts}
              district={district}
              onDistrict={setDistrict}
              extra={
                <>
                  <FilterChip label={t('services.openNow')} icon="schedule" active={openNow} onPress={() => setOpenNow((v) => !v)} />
                  <FilterChip label={t('services.verifiedOnly')} icon="verified" active={verifiedOnly} onPress={() => setVerifiedOnly((v) => !v)} />
                </>
              }
            />
          </>
        ) : null}

        {!location ? (
          <>
            <StateMessage kind="empty" message={t('business.noProvince')} />
            <AppButton title={t('business.chooseLocation')} onPress={() => router.push('/location?edit=1')} />
          </>
        ) : error ? (
          <StateMessage kind="error" message={t('business.listError')} onRetry={load} />
        ) : !ranked ? (
          <StateMessage kind="loading" />
        ) : total === 0 ? (
          <>
            <AppText variant="subtitle">{id === 'taksi' ? t('services.taxiCompanies') : t('services.emptyTitle')}</AppText>
            <StateMessage kind="empty" message={t('services.emptyBody')} />
          </>
        ) : (
          <>
            {filtered && !featured.length && !others.length ? <StateMessage kind="empty" message={t('services.noFilterMatch')} /> : null}
            {featured.map((b) => <BusinessCard key={b.id} business={b} featured />)}
            {verifiedOthers.map((b) => <BusinessCard key={b.id} business={b} />)}
            {unverified.length ? (
              <View style={styles.section}>
                <AppText variant="label" accessibilityRole="header">{t('business.tiers.unverifiedSection')}</AppText>
                <AppText variant="caption" muted>{t('business.unverifiedWarning')}</AppText>
              </View>
            ) : null}
            {unverified.map((b) => <BusinessCard key={b.id} business={b} />)}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showRules }}
              onPress={() => setShowRules((v) => !v)}
              style={[styles.rules, { borderColor: c.border }]}>
              <View style={styles.rulesHead}>
                <MaterialIcons name="info-outline" size={18} color={c.textMuted} />
                <AppText variant="caption" style={[styles.flex, { color: c.text }]}>{t('business.rankingTitle')}</AppText>
                <MaterialIcons name={showRules ? 'expand-less' : 'expand-more'} size={20} color={c.textSoft} />
              </View>
              {showRules ? <AppText variant="caption" muted>{t('business.rankingBody')}</AppText> : null}
            </Pressable>
            <AppText variant="caption" muted>{t('business.infoOnly')}</AppText>
          </>
        )}

        <AppButton variant="ghost" title={t('services.suggestCta')} onPress={() => router.push('/services/suggest')} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  flex: { flex: 1 },
  section: { gap: 2, marginTop: spacing.sm },
  warning: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  callLink: { fontWeight: '700', marginTop: 4, textDecorationLine: 'underline' },
  rules: { borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, gap: spacing.xs },
  rulesHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
