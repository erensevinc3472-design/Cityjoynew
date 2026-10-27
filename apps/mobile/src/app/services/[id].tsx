import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { findCategory, localized, rankBusinesses, type RankedBusinesses } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { BusinessCard } from '@/components/business-card';
import { HeroHeader } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { locationRepository } from '@/lib/locations';
import { useServiceCategories } from '@/lib/service-categories';
import { businessRepository } from '@/lib/services';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * Bir hizmetin işletme listesi, kullanıcının ilinde. Sıralama herkes için aynı kural (Karar, Eren;
 * PROJE.md 5.6): en çok 2 "Reklam" kartı, sonra doğrulanmış, puan, ilçe, güncellik. Acil kategoride
 * 112 hatırlatması üstte durur.
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

  const [ranked, setRanked] = useState<RankedBusinesses | null>(null);
  const [error, setError] = useState(false);
  const [showRules, setShowRules] = useState(false);

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

  const header = (
    <HeroHeader
      title={category ? localized(category.names, lang) : t('services.title')}
      subtitle={subtitle || undefined}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/services'))}
    />
  );
  const total = ranked ? ranked.featured.length + ranked.others.length : 0;
  const anyUnverified = !!ranked && [...ranked.featured, ...ranked.others].some((b) => b.verification.status !== 'dogrulandi');

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {category?.urgent ? (
          <>
            <View style={[styles.warning, { backgroundColor: c.dangerSoft, borderColor: c.danger }]}>
              <MaterialIcons name={'warning-amber' as IconName} size={22} color={c.danger} />
              <AppText variant="caption" style={styles.flex}>{t('services.urgentNote')}</AppText>
            </View>
            <AppButton variant="secondary" title={t('services.emergencyNumbers')} onPress={() => router.push('/urgent')} />
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
            <AppText variant="subtitle">{t('services.emptyTitle')}</AppText>
            <StateMessage kind="empty" message={t('services.emptyBody')} />
          </>
        ) : (
          <>
            {ranked.featured.map((b) => <BusinessCard key={b.id} business={b} featured />)}
            {ranked.others.map((b) => <BusinessCard key={b.id} business={b} />)}
            {category?.urgent && anyUnverified ? <AppText variant="caption" muted>{t('business.unverifiedWarning')}</AppText> : null}
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
  warning: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  rules: { borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, gap: spacing.xs },
  rulesHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
