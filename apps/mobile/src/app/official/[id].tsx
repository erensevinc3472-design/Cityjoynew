import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { isMunicipalityId, mayorProfileId } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { HeroHeader } from '@/components/hero-header';
import { OfficialProfileCard } from '@/components/official-profile-card';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useNeighbourhoodName } from '@/lib/announcements';
import { locationRepository as repo } from '@/lib/locations';
import { useOfficialFollow } from '@/lib/official-follows';
import { useSettings } from '@/lib/settings';
import { useOfficialProfile } from '@/lib/official-profiles';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Resmî profil (PROJE.md 6.2 madde 2): kurumun, muhtarlığın ya da belediye başkanının künyesi. Duyuru ve etkinlikte
 * yayınlayanın adına dokununca açılır. Profil girilmemişse ad ve "henüz bilgi eklenmedi" notu görünür. Profil varsa
 * takip edilebilir (kitle istatistiği isimsiz; PROJE.md 6.1). Belediye sayfasında başkan kartı, başkan profili girilmişse
 * görünür.
 */
export default function OfficialProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { rtl } = useSettings();
  const { id, label } = useLocalSearchParams<{ id: string; label?: string }>();
  const { profile, loading } = useOfficialProfile(id);
  const mayorId = id && isMunicipalityId(id) ? mayorProfileId(id) : null;
  const { profile: mayor } = useOfficialProfile(mayorId);
  const follow = useOfficialFollow(profile ? id : undefined);
  const neighbourhood = useNeighbourhoodName(profile?.region ? { region: profile.region } : null);
  const r = profile?.region;
  const place = r ? [r.districtId ? repo.getDistrict(r.districtId)?.name : null, repo.getProvince(r.provinceCode)?.name].filter(Boolean).join(', ') : '';
  const isMuhtar = id?.startsWith('mahalle-');
  const isMayor = id?.startsWith('baskan-');
  const muhtarlik = isMuhtar && neighbourhood ? t('announcements.muhtarOf', { place: neighbourhood }) : label;
  const title = isMuhtar ? (profile?.name || muhtarlik || '') : (profile?.name || label || '');
  const subtitle = [isMuhtar && profile?.name ? muhtarlik : null, isMayor ? t('official.mayor') : null, place].filter(Boolean).join(' · ');

  const header = (
    <HeroHeader title={isMayor ? t('official.mayorTitle') : t('official.title')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />
  );

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content}>
        {loading && profile === undefined ? (
          <StateMessage kind="loading" />
        ) : (
          <>
            <OfficialProfileCard title={title} subtitle={subtitle || undefined} profile={profile} place={place} />
            {follow.canFollow ? (
              <View style={styles.follow}>
                <AppButton
                  variant={follow.following ? 'secondary' : 'primary'}
                  title={follow.following ? t('official.following') : t('official.follow')}
                  loading={follow.busy}
                  onPress={follow.toggle}
                />
                {follow.error ? <AppText variant="caption" style={{ color: c.danger }}>{t('official.followError')}</AppText> : null}
                <AppText variant="caption" muted>{t('official.followHint')}</AppText>
              </View>
            ) : null}
            {mayor && mayorId ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t('official.mayor')}: ${mayor.name}`}
                onPress={() => router.push({ pathname: '/official/[id]', params: { id: mayorId } })}
                style={({ pressed }) => [styles.mayor, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.85 : 1 }]}
              >
                {mayor.logo ? (
                  <Image source={{ uri: mayor.logo.url }} style={[styles.photo, { backgroundColor: c.surfaceStrong }]} contentFit="cover" accessibilityIgnoresInvertColors />
                ) : (
                  <View style={[styles.photo, styles.initial, { backgroundColor: c.accentSoft }]}>
                    <AppText style={[styles.initialText, { color: c.icon }]}>{mayor.name.slice(0, 1)}</AppText>
                  </View>
                )}
                <View style={styles.mayorText}>
                  <AppText variant="caption" muted>{t('official.mayor')}</AppText>
                  <AppText style={[styles.mayorName, { color: c.textStrong }]}>{mayor.name}</AppText>
                </View>
                <MaterialIcons name={rtl ? 'chevron-left' : 'chevron-right'} size={22} color={c.textSoft} />
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  follow: { gap: spacing.xs },
  mayor: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  photo: { width: 52, height: 52, borderRadius: 26 },
  initial: { alignItems: 'center', justifyContent: 'center' },
  initialText: { fontFamily: fonts.heading, fontSize: 20 },
  mayorText: { flex: 1, gap: 2 },
  mayorName: { fontFamily: fonts.heading, fontSize: 16 },
});
