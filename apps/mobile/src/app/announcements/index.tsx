import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AnnouncementCard } from '@/components/announcement-card';
import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { HeroHeader, LocationChip } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useAnnouncements } from '@/lib/announcements';
import { locationRepository as repo } from '@/lib/locations';
import { useUserLocation } from '@/lib/user-location';
import { spacing } from '@/theme/tokens';

/**
 * Duyurular: kullanıcının ilinin geneline, ilçesine ve mahallesine yönelik resmî duyurular (belediye, kurum, muhtar).
 * Acil duyurular en üstte (PROJE.md 5.5).
 */
export default function AnnouncementsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { location } = useUserLocation();
  const { list, failed, reload } = useAnnouncements(location);
  const place = [location?.districtId ? repo.getDistrict(location.districtId)?.name : null, location ? repo.getProvince(location.provinceCode)?.name : null].filter(Boolean).join(', ');

  const header = (
    <HeroHeader title={t('announcements.title')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))}>
      <LocationChip label={place || t('home.noLocation')} onPress={() => router.push('/location?edit=1')} />
    </HeroHeader>
  );

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}>
        {!location ? (
          <View style={styles.content}>
            <StateMessage kind="empty" message={t('announcements.needLocation')} />
            <AppButton title={t('home.changeLocation')} onPress={() => router.push('/location?edit=1')} />
          </View>
        ) : failed && !list?.length ? (
          <StateMessage kind="error" message={t('announcements.loadError')} onRetry={reload} />
        ) : list === null ? (
          <StateMessage kind="loading" />
        ) : list.length === 0 ? (
          <StateMessage kind="empty" message={t('announcements.empty')} />
        ) : (
          list.map((a) => <AnnouncementCard key={a.id} item={a} onPress={() => router.push({ pathname: '/announcements/[id]', params: { id: a.id } })} />)
        )}
        <AppText variant="caption" muted>{t('announcements.scopeNote')}</AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
});
