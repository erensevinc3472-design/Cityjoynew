import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CITY_GUIDE_SECTIONS, type CityGuideSection } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { HeroHeader, LocationChip } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useCityGuideMeta } from '@/lib/city-guide';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];
const iconOf = (s: CityGuideSection) => (s.icon in MaterialIcons.glyphMap ? s.icon : 'place') as IconName;

/**
 * Benim Şehrim (PROJE.md 5.1): kullanıcının ilinin sabit bilgileri. Bölümler veritabanından, il başına gelir;
 * özet tek okumayla alınır, bölümler telefonda saklanır. Bilgi girilmemiş bölümler "yakında" görünür.
 */
export default function MyCityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const { location } = useUserLocation();
  const provinceCode = location?.provinceCode;
  const { meta, stale, failed } = useCityGuideMeta(provinceCode);
  const province = provinceCode ? repo.getProvince(provinceCode)?.name : undefined;
  const district = location?.districtId ? repo.getDistrict(location.districtId)?.name : undefined;

  const header = (
    <HeroHeader title={t('modules.myCity')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))}>
      <LocationChip label={[district, province].filter(Boolean).join(', ') || t('home.noLocation')} onPress={() => router.push('/location?edit=1')} />
    </HeroHeader>
  );

  if (!provinceCode) {
    return (
      <Screen header={header}>
        <View style={styles.content}>
          <StateMessage kind="empty" message={t('city.needLocation')} />
          <AppButton title={t('home.changeLocation')} onPress={() => router.push('/location?edit=1')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {stale ? <AppText variant="caption" muted>{t('city.staleNote')}</AppText> : null}
        {failed && !meta ? <StateMessage kind="error" message={t('city.loadError')} /> : !meta ? <StateMessage kind="loading" /> : null}
        {/* Mahalle Meydanı: mahallenin künyesi (muhtarlık, duyurular, etkinlikler, toplanma alanları). */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('neighbourhood.title')}. ${t('neighbourhood.hint')}`}
          onPress={() => router.push('/neighbourhood')}
          style={({ pressed }) => [styles.wide, { backgroundColor: c.surface, borderColor: c.border, shadowColor: c.shadow, opacity: pressed ? 0.85 : 1 }]}>
          <View style={[styles.icon, { backgroundColor: c.accentSoft, marginBottom: 0 }]}>
            <MaterialIcons name="holiday-village" size={22} color={c.icon} />
          </View>
          <View style={styles.wideText}>
            <AppText style={[styles.tileTitle, { color: c.textStrong }]}>{t('neighbourhood.title')}</AppText>
            <AppText variant="caption" muted>{t('neighbourhood.hint')}</AppText>
          </View>
        </Pressable>
        <View style={styles.grid}>
          {CITY_GUIDE_SECTIONS.map((s) => {
            const count = meta?.sections[s.id]?.count ?? 0;
            // "Nasıl yapılır?" ülke geneli içerikle de dolar; il boş olsa da açılır.
            const ready = count > 0 || s.id === 'nasil-yapilir';
            const name = s.names[lang] ?? s.names.tr;
            return (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityLabel={ready ? name : `${name}. ${t('city.comingSoon')}`}
                disabled={!ready || !meta}
                onPress={() => router.push({ pathname: '/city/[section]', params: { section: s.id } })}
                style={({ pressed }) => [
                  styles.tile,
                  { backgroundColor: c.surface, borderColor: c.border, shadowColor: c.shadow, opacity: !ready ? 0.6 : pressed ? 0.85 : 1 },
                ]}>
                <View style={[styles.icon, { backgroundColor: c.accentSoft }]}>
                  <MaterialIcons name={iconOf(s)} size={22} color={c.icon} />
                </View>
                <AppText style={[styles.tileTitle, { color: c.textStrong }]}>{name}</AppText>
                <AppText variant="caption" muted>{ready && count ? t('city.count', { count }) : ready ? '' : t('city.comingSoon')}</AppText>
              </Pressable>
            );
          })}
        </View>
        <AppText variant="caption" muted style={styles.center}>{t('city.otherSections')}</AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 120,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  wide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  wideText: { flex: 1, gap: 2 },
  icon: { width: 42, height: 42, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  tileTitle: { fontFamily: fonts.heading, fontSize: 15, lineHeight: 21 },
  center: { textAlign: 'center' },
});
