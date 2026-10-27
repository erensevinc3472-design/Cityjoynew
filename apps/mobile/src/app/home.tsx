import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { HeroHeader, LocationChip } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { VerifyEmailBanner } from '@/components/verify-email-banner';
import { locationRepository as repo } from '@/lib/locations';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const MODULES: { key: string; icon: IconName; urgent?: boolean }[] = [
  { key: 'myCity', icon: 'location-city' },
  { key: 'travel', icon: 'explore' },
  { key: 'social', icon: 'groups' },
  { key: 'urgent', icon: 'emergency', urgent: true },
];

function greetingKey(now = new Date()) {
  const h = now.getHours();
  if (h >= 5 && h < 12) return 'home.greetingMorning';
  if (h >= 12 && h < 18) return 'home.greetingDay';
  return 'home.greetingEvening';
}

/** Ana sayfa. Benim Şehrim ve Acil İhtiyaçlar bağlı; diğer modüller sonraki aşamalarda bağlanacak. */
export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language } = useSettings();
  const { location } = useUserLocation();
  const { user, profile } = useSession();
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
  const firstName = (profile?.displayName ?? user?.displayName ?? '').trim().split(/\s+/)[0];
  // "Senin Keşfin, Senin Keyfin": ikinci yarı altın.
  const [sloganLead, sloganAccent] = t('home.slogan').split(/[,،]\s*/);

  const header = (
    <HeroHeader
      title="CityJoy"
      right={user ? { icon: 'person-outline', label: t('home.account'), onPress: () => router.push('/account') } : undefined}>
      <View style={styles.heroText}>
        {firstName ? <AppText style={{ color: c.heroMuted }}>{t(greetingKey(), { name: firstName })}</AppText> : null}
        <AppText accessibilityRole="header" style={[styles.slogan, { color: c.heroText }]}>
          {sloganLead}
          {sloganAccent ? ', ' : ''}
          {sloganAccent ? <AppText style={[styles.slogan, { color: c.heroAccent }]}>{sloganAccent}</AppText> : null}
        </AppText>
      </View>
      <LocationChip label={locationText} onPress={() => router.push('/location?edit=1')} />
    </HeroHeader>
  );

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <VerifyEmailBanner />
        <View style={styles.grid}>
          {MODULES.map((m) => {
            // Benim Şehrim ve Acil İhtiyaçlar hazır; diğerleri sonraki aşamalarda bağlanacak.
            const href = m.key === 'urgent' ? '/urgent' : m.key === 'myCity' ? '/city' : undefined;
            return (
              <Pressable
                key={m.key}
                accessibilityRole={href ? 'button' : undefined}
                disabled={!href}
                accessibilityLabel={href ? t(`modules.${m.key}`) : `${t(`modules.${m.key}`)}. ${t('home.comingSoon')}`}
                onPress={href ? () => router.push(href) : undefined}
                style={({ pressed }) => [styles.module, { backgroundColor: c.surface, borderColor: m.urgent ? c.danger : c.border, shadowColor: c.shadow, opacity: pressed ? 0.85 : 1 }]}>
                <View style={[styles.icon, { backgroundColor: m.urgent ? c.dangerSoft : c.accentSoft }]}>
                  <MaterialIcons name={m.icon} size={22} color={m.urgent ? c.danger : c.icon} />
                </View>
                <AppText style={[styles.moduleTitle, { color: c.textStrong }]}>{t(`modules.${m.key}`)}</AppText>
                <AppText variant="caption" muted>{t(`modules.${m.key}Hint`)}</AppText>
              </Pressable>
            );
          })}
        </View>
        <AppText variant="caption" muted style={styles.center}>{t('home.comingSoon')}</AppText>
        <AppButton variant="ghost" title={`${t('home.changeLanguage')} · ${languageName}`} onPress={() => router.push('/language')} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  heroText: { gap: 2 },
  slogan: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 33 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  module: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 132,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  icon: { width: 42, height: 42, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  moduleTitle: { fontFamily: fonts.heading, fontSize: 16, lineHeight: 22 },
  center: { textAlign: 'center' },
});
