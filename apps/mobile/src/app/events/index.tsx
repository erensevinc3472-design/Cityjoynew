import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { EventCard } from '@/components/event-card';
import { HeroHeader, LocationChip } from '@/components/hero-header';
import { OptionRow } from '@/components/option-row';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useEvents } from '@/lib/events';
import { locationRepository as repo } from '@/lib/locations';
import { useUserLocation } from '@/lib/user-location';
import { spacing } from '@/theme/tokens';

/** Etkinlikler: kullanıcının ilindeki yaklaşan etkinlikler; istenirse yalnızca kendi ilçesi. */
export default function EventsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { location } = useUserLocation();
  const { list, failed, reload } = useEvents(location?.provinceCode);
  const [onlyDistrict, setOnlyDistrict] = useState(false);
  const district = location?.districtId ? repo.getDistrict(location.districtId) : undefined;
  const province = location ? repo.getProvince(location.provinceCode)?.name : undefined;
  // İl geneli etkinlikler ilçe süzgecinde de görünür.
  const shown = list && onlyDistrict && district ? list.filter((e) => !e.region.districtId || e.region.districtId === district.id) : list;

  const header = (
    <HeroHeader title={t('events.title')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/social'))}>
      <LocationChip label={province ?? t('home.noLocation')} onPress={() => router.push('/location?edit=1')} />
    </HeroHeader>
  );

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}>
        {!location ? (
          <>
            <StateMessage kind="empty" message={t('events.needLocation')} />
            <AppButton title={t('home.changeLocation')} onPress={() => router.push('/location?edit=1')} />
          </>
        ) : (
          <>
            {district ? (
              <View style={styles.filters}>
                <OptionRow title={t('events.wholeProvince', { place: province ?? '' })} selected={!onlyDistrict} onPress={() => setOnlyDistrict(false)} />
                <OptionRow title={t('events.onlyDistrict', { place: district.name })} selected={onlyDistrict} onPress={() => setOnlyDistrict(true)} />
              </View>
            ) : null}
            {failed && !list?.length ? (
              <StateMessage kind="error" message={t('events.loadError')} onRetry={reload} />
            ) : shown === null ? (
              <StateMessage kind="loading" />
            ) : shown.length === 0 ? (
              <StateMessage kind="empty" message={t('events.empty')} />
            ) : (
              shown.map((e) => <EventCard key={e.id} item={e} onPress={() => router.push({ pathname: '/events/[id]', params: { id: e.id } })} />)
            )}
            <AppText variant="caption" muted>{t('events.note')}</AppText>
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
