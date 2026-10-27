import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

const MODULES = [
  { key: 'myCity', icon: 'location-city' },
  { key: 'travel', icon: 'travel-explore' },
  { key: 'social', icon: 'groups' },
  { key: 'urgent', icon: 'emergency' },
] as const;

/** Geçici ana sayfa: modüller sonraki aşamalarda bağlanacak. */
export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { location, language } = useSettings();
  const [neighbourhoodName, setNeighbourhoodName] = useState<string>();

  useEffect(() => {
    setNeighbourhoodName(undefined);
    const { districtId, neighbourhoodId } = location ?? {};
    if (!districtId || !neighbourhoodId) return;
    repo
      .getNeighbourhoods(districtId)
      .then((list) => setNeighbourhoodName(list.find((n) => n.id === neighbourhoodId)?.name))
      .catch(() => {});
  }, [location]);

  const parts = location
    ? [neighbourhoodName, location.districtId && repo.getDistrict(location.districtId)?.name, repo.getProvince(location.provinceCode)?.name]
    : [];
  const locationText = parts.filter(Boolean).join(', ') || t('home.noLocation');
  const languageName = LANGUAGES.find((l) => l.code === language)?.nativeName;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <AppText variant="caption" style={{ color: c.highlight }}>CityJoy</AppText>
          <AppText variant="title">{t('home.slogan')}</AppText>
        </View>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.cardRow}>
            <MaterialIcons name="place" size={22} color={c.accent} />
            <View style={styles.flex}>
              <AppText variant="caption" muted>{t('home.yourLocation')}</AppText>
              <AppText variant="label">{locationText}</AppText>
            </View>
          </View>
          <AppButton variant="secondary" title={t('home.changeLocation')} onPress={() => router.push('/location')} />
        </View>

        <View style={styles.grid}>
          {MODULES.map((m) => (
            <View
              key={m.key}
              accessible
              accessibilityLabel={`${t(`modules.${m.key}`)}. ${t('home.comingSoon')}`}
              style={[styles.module, { backgroundColor: c.primary }]}>
              <MaterialIcons name={m.icon} size={32} color={c.onPrimary} />
              <AppText variant="label" style={{ color: c.onPrimary }}>{t(`modules.${m.key}`)}</AppText>
            </View>
          ))}
        </View>
        <AppText variant="caption" muted style={styles.center}>{t('home.comingSoon')}</AppText>

        <AppButton variant="ghost" title={`${t('home.changeLanguage')} · ${languageName}`} onPress={() => router.push('/language')} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  hero: { gap: spacing.xs, paddingTop: spacing.lg },
  card: { gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  module: { flexGrow: 1, flexBasis: '45%', minHeight: 110, borderRadius: radius.lg, padding: spacing.md, justifyContent: 'space-between' },
  center: { textAlign: 'center' },
});
