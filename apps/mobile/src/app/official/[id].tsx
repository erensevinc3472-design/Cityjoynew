import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { HeroHeader } from '@/components/hero-header';
import { OfficialProfileCard } from '@/components/official-profile-card';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useNeighbourhoodName } from '@/lib/announcements';
import { locationRepository as repo } from '@/lib/locations';
import { useOfficialProfile } from '@/lib/official-profiles';
import { spacing } from '@/theme/tokens';

/**
 * Resmî profil (PROJE.md 6.2 madde 2): kurumun ya da muhtarlığın künyesi. Duyuru ve etkinlikte yayınlayanın adına
 * dokununca açılır. Profil girilmemişse ad ve "henüz bilgi eklenmedi" notu görünür.
 */
export default function OfficialProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id, label } = useLocalSearchParams<{ id: string; label?: string }>();
  const { profile, loading } = useOfficialProfile(id);
  const neighbourhood = useNeighbourhoodName(profile?.region ? { region: profile.region } : null);
  const r = profile?.region;
  const place = r ? [r.districtId ? repo.getDistrict(r.districtId)?.name : null, repo.getProvince(r.provinceCode)?.name].filter(Boolean).join(', ') : '';
  const isMuhtar = id?.startsWith('mahalle-');
  const muhtarlik = isMuhtar && neighbourhood ? t('announcements.muhtarOf', { place: neighbourhood }) : label;
  const title = isMuhtar ? (profile?.name || muhtarlik || '') : (profile?.name || label || '');
  const subtitle = [isMuhtar && profile?.name ? muhtarlik : null, place].filter(Boolean).join(' · ');

  const header = <HeroHeader title={t('official.title')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />;

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content}>
        {loading && profile === undefined ? <StateMessage kind="loading" /> : <OfficialProfileCard title={title} subtitle={subtitle || undefined} profile={profile} place={place} />}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
});
