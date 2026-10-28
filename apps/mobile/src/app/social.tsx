import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/app-text';
import { HeroHeader, LocationChip } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { locationRepository as repo } from '@/lib/locations';
import { useUserLocation } from '@/lib/user-location';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/** Sosyal Harmoni bölümleri (PROJE.md 5.3). Hazır olanlar açılır, diğerleri "yakında". */
const SECTIONS: { key: string; icon: IconName; href?: '/events' }[] = [
  { key: 'events', icon: 'event', href: '/events' },
  { key: 'activities', icon: 'groups' },
  { key: 'news', icon: 'newspaper' },
  { key: 'contests', icon: 'emoji-events' },
  { key: 'polls', icon: 'poll' },
  { key: 'forum', icon: 'forum' },
  { key: 'clubs', icon: 'sports-soccer' },
  { key: 'deals', icon: 'local-offer' },
];

export default function SocialScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { location } = useUserLocation();
  const province = location ? repo.getProvince(location.provinceCode)?.name : undefined;

  const header = (
    <HeroHeader title={t('modules.social')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))}>
      <LocationChip label={province ?? t('home.noLocation')} onPress={() => router.push('/location?edit=1')} />
    </HeroHeader>
  );

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {SECTIONS.map((s) => {
            const name = t(`social.sections.${s.key}`);
            return (
              <Pressable
                key={s.key}
                accessibilityRole="button"
                accessibilityLabel={s.href ? name : `${name}. ${t('home.comingSoon')}`}
                disabled={!s.href}
                onPress={s.href ? () => router.push(s.href!) : undefined}
                style={({ pressed }) => [styles.tile, { backgroundColor: c.surface, borderColor: c.border, shadowColor: c.shadow, opacity: !s.href ? 0.6 : pressed ? 0.85 : 1 }]}>
                <View style={[styles.icon, { backgroundColor: c.accentSoft }]}>
                  <MaterialIcons name={s.icon} size={22} color={c.icon} />
                </View>
                <AppText style={[styles.tileTitle, { color: c.textStrong }]}>{name}</AppText>
                {s.href ? null : <AppText variant="caption" muted>{t('city.comingSoon')}</AppText>}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexGrow: 1, flexBasis: '45%', minHeight: 110, borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, gap: spacing.xs, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 10 },
  icon: { width: 42, height: 42, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  tileTitle: { fontFamily: fonts.heading, fontSize: 15, lineHeight: 21 },
});
