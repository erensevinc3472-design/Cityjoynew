import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { canUseActivities } from '@cityjoy/shared';

import { ActivityCard } from '@/components/activity-card';
import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { FormMessage } from '@/components/form-message';
import { HeroHeader, LocationChip } from '@/components/hero-header';
import { OptionRow } from '@/components/option-row';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useActivities, useNeighbourhoodNames } from '@/lib/activities';
import { locationRepository as repo } from '@/lib/locations';
import { useSession } from '@/lib/session';
import { useUserLocation } from '@/lib/user-location';
import { spacing } from '@/theme/tokens';

type Scope = 'il' | 'ilce' | 'mahalle';

/**
 * Aktiviteler (PROJE.md 5.3): kullanıcıların açtığı buluşmalar. İldeki yaklaşanlar, istenirse yalnızca ilçe ya da
 * mahalle. "+ Aktivite aç" yalnızca giriş yapmış 18 yaş ve üstü kullanıcıya.
 */
export default function ActivitiesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, profile } = useSession();
  const { location } = useUserLocation();
  const { list, failed, reload } = useActivities(location?.provinceCode, !!user);
  const [scope, setScope] = useState<Scope>('il');
  const names = useNeighbourhoodNames(list);
  const district = location?.districtId ? repo.getDistrict(location.districtId) : undefined;
  const province = location ? repo.getProvince(location.provinceCode)?.name : undefined;
  const nb = location?.neighbourhoodId;
  const shown =
    list && scope === 'ilce' && district ? list.filter((a) => a.region.districtId === district.id)
    : list && scope === 'mahalle' && nb ? list.filter((a) => a.region.neighbourhoodId === nb)
    : list;
  const adult = canUseActivities(profile?.birthYear);

  const header = (
    <HeroHeader title={t('activities.title')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/social'))}>
      <LocationChip label={province ?? t('home.noLocation')} onPress={() => router.push('/location?edit=1')} />
    </HeroHeader>
  );

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}>
        <AppText muted>{t('activities.intro')}</AppText>
        {!user ? (
          <FormMessage kind="info" text={t('activities.signIn')} />
        ) : !location ? (
          <>
            <StateMessage kind="empty" message={t('activities.needLocation')} />
            <AppButton title={t('home.changeLocation')} onPress={() => router.push('/location?edit=1')} />
          </>
        ) : (
          <>
            {adult ? <AppButton title={t('activities.create')} onPress={() => router.push('/activities/new')} /> : <FormMessage kind="info" text={t('activities.adultsOnly')} />}
            {district ? (
              <View style={styles.filters}>
                <OptionRow title={t('activities.scopeProvince', { place: province ?? '' })} selected={scope === 'il'} onPress={() => setScope('il')} />
                <OptionRow title={t('activities.scopeDistrict', { place: district.name })} selected={scope === 'ilce'} onPress={() => setScope('ilce')} />
                {nb ? <OptionRow title={t('activities.scopeNeighbourhood')} selected={scope === 'mahalle'} onPress={() => setScope('mahalle')} /> : null}
              </View>
            ) : null}
            {failed && !list?.length ? (
              <StateMessage kind="error" message={t('activities.loadError')} onRetry={reload} />
            ) : shown === null ? (
              <StateMessage kind="loading" />
            ) : shown.length === 0 ? (
              <StateMessage kind="empty" message={t('activities.empty')} />
            ) : (
              shown.map((a) => (
                <ActivityCard key={a.id} item={a} neighbourhood={names[a.region.neighbourhoodId]} onPress={() => router.push({ pathname: '/activities/[id]', params: { id: a.id } })} />
              ))
            )}
            <AppText variant="caption" muted>{t('activities.note')}</AppText>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  filters: { gap: spacing.xs },
});
