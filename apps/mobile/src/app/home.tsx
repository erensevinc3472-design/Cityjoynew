import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { VerifyEmailBanner } from '@/components/verify-email-banner';
import { locationRepository as repo } from '@/lib/locations';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

const MODULES = [
  { key: 'myCity', icon: 'location-city' },
  { key: 'travel', icon: 'explore' },
  { key: 'social', icon: 'groups' },
  { key: 'urgent', icon: 'emergency' },
] as const;

/** Ana sayfa (tasarım: anasayfa.html). Modüller sonraki aşamalarda bağlanacak. */
export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language, rtl } = useSettings();
  const { location } = useUserLocation();
  const { user } = useSession();
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
  // "Senin Keşfin, Senin Keyfin": ikinci yarı altın italik (tasarımdaki gibi).
  const [sloganLead, sloganAccent] = t('home.slogan').split(/[,،]\s*/);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <AppText variant="label" style={[styles.brand, { color: c.textStrong }]}>CityJoy</AppText>
          {user ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('home.account')} onPress={() => router.push('/account')} style={[styles.round, { borderColor: c.border, backgroundColor: c.surface }]}>
              <MaterialIcons name="person-outline" size={22} color={c.textStrong} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.hero} accessible accessibilityRole="header" accessibilityLabel={t('home.slogan')}>
          <AppText style={[styles.sloganLead, { color: c.textStrong }]}>{sloganLead}{sloganAccent ? ',' : ''}</AppText>
          {sloganAccent ? <AppText style={[styles.sloganAccent, { color: c.accent }]}>{sloganAccent}</AppText> : null}
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel={`${t('home.yourLocation')}: ${locationText}. ${t('home.changeLocation')}`} onPress={() => router.push('/location?edit=1')} style={styles.locationRow}>
          <MaterialIcons name="place" size={18} color={c.accent} />
          <AppText variant="label" style={styles.locationText}>{locationText}</AppText>
          <MaterialIcons name="edit" size={16} color={c.textMuted} />
        </Pressable>

        <VerifyEmailBanner />

        <View style={styles.modules}>
          {MODULES.map((m) => (
            <View
              key={m.key}
              accessible
              accessibilityLabel={`${t(`modules.${m.key}`)}. ${t('home.comingSoon')}`}
              style={[styles.module, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={[styles.icon, { borderColor: c.accentBorder, backgroundColor: c.accentSoft }]}>
                <MaterialIcons name={m.icon} size={22} color={c.accent} />
              </View>
              <View style={styles.flex}>
                <AppText variant="label" style={{ color: c.textStrong }}>{t(`modules.${m.key}`)}</AppText>
                <AppText variant="caption" muted style={styles.hint}>{t(`modules.${m.key}Hint`)}</AppText>
              </View>
              <MaterialIcons name={rtl ? 'chevron-left' : 'chevron-right'} size={22} color={c.textMuted} />
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
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  brand: { letterSpacing: 3, fontFamily: fonts.heading },
  round: { width: 44, height: 44, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', paddingTop: spacing.md },
  sloganLead: { fontFamily: fonts.heading, fontSize: 30, lineHeight: 38, textAlign: 'center' },
  sloganAccent: { fontFamily: fonts.accentSerif, fontSize: 32, lineHeight: 40, textAlign: 'center' },
  locationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, minHeight: 44 },
  locationText: { flexShrink: 1, textAlign: 'center' },
  modules: { gap: spacing.sm },
  module: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  icon: { width: 44, height: 44, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { textTransform: 'uppercase', letterSpacing: 1, fontSize: 11 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
});
