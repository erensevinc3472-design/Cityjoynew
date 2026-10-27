import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { findCategory, localized } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { HeroHeader } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { locationRepository } from '@/lib/locations';
import { useServiceCategories } from '@/lib/service-categories';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * Bir hizmetin işletme listesi. İşletme kaydı (İşletmem, PROJE.md 5.7) gelene kadar boş durum gösterilir.
 * Acil kategorilerde 112 hatırlatması üstte durur.
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

  const header = (
    <HeroHeader
      title={category ? localized(category.names, lang) : t('services.title')}
      subtitle={subtitle || undefined}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/services'))}
    />
  );

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {category?.urgent ? (
          <View style={[styles.warning, { backgroundColor: c.dangerSoft, borderColor: c.danger }]}>
            <MaterialIcons name={'warning-amber' as IconName} size={22} color={c.danger} />
            <AppText variant="caption" style={styles.flex}>{t('services.urgentNote')}</AppText>
          </View>
        ) : null}
        {category?.urgent ? <AppButton variant="secondary" title={t('services.emergencyNumbers')} onPress={() => router.push('/urgent')} /> : null}
        <AppText variant="subtitle">{t('services.emptyTitle')}</AppText>
        <StateMessage kind="empty" message={t('services.emptyBody')} />
        <AppButton variant="ghost" title={t('services.suggestCta')} onPress={() => router.push('/services/suggest')} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  flex: { flex: 1 },
  warning: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
});
