import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Adoption } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { FormMessage } from '@/components/form-message';
import { HeroHeader } from '@/components/hero-header';
import { RowIcon, Tag } from '@/components/inner';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { cachedAdoption } from '@/lib/adoptions';
import { locationRepository as repo } from '@/lib/locations';
import { adoptionRepository } from '@/lib/services';
import { fonts, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/** Sahiplendirilecek hayvan: bilgiler, yayınlayan barınak / dernek, Ara ve E-posta. Sahiplendirme ücretsizdir. */
export default function AnimalScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<Adoption | null | undefined>(() => cachedAdoption(id));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (item !== undefined) return;
    adoptionRepository.get(id).then(setItem, () => setFailed(true));
  }, [id, item]);

  const open = (url: string) => Linking.openURL(url).catch(() => {});
  const header = <HeroHeader title={t('volunteer.animal')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/volunteer'))} />;
  if (failed || !item || item.status !== 'yayinda') {
    return (
      <Screen header={header}>
        <View style={styles.content}>
          {failed ? <StateMessage kind="error" message={t('volunteer.loadError')} /> : item === undefined ? <StateMessage kind="loading" /> : (
            <StateMessage kind="empty" message={item?.status === 'sahiplendirildi' ? t('volunteer.adopted') : t('volunteer.gone')} />
          )}
        </View>
      </Screen>
    );
  }
  const place = [item.region.districtId ? repo.getDistrict(item.region.districtId)?.name : null, repo.getProvince(item.region.provinceCode)?.name].filter(Boolean).join(', ');

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <RowIcon icon="pets" tint={item.urgent ? c.danger : c.primary} size={56} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText accessibilityRole="header" style={[styles.name, { color: c.textStrong }]}>{item.name}</AppText>
            <AppText muted>{[t(`volunteer.species.${item.species}`), item.age, t(`volunteer.sex.${item.sex}`), item.breed].filter(Boolean).join(' · ')}</AppText>
          </View>
        </View>
        <View style={styles.tags}>
          {item.urgent ? <Tag label={t('volunteer.urgent')} tone="red" /> : null}
          <Tag label={item.vaccinated ? t('volunteer.vaccinated') : t('volunteer.notVaccinated')} tone={item.vaccinated ? 'green' : 'muted'} />
          {item.neutered ? <Tag label={t('volunteer.neutered')} tone="green" /> : null}
        </View>
        <AppText selectable>{item.about}</AppText>
        <View style={{ gap: 2 }}>
          <AppText variant="label">{t('volunteer.where')}</AppText>
          <AppText>{place}</AppText>
        </View>
        <View style={{ gap: 2 }}>
          <AppText variant="label">{t('volunteer.by')}</AppText>
          <AppText>{item.org.name}</AppText>
        </View>
        {item.phone ? <AppButton title={t('volunteer.call')} onPress={() => open(`tel:${item.phone!.replace(/[^0-9+]/g, '')}`)} /> : null}
        {item.email ? <AppButton variant="secondary" title={t('volunteer.email')} onPress={() => open(`mailto:${item.email}?subject=${encodeURIComponent(t('volunteer.mailSubject', { name: item.name }))}`)} /> : null}
        <FormMessage kind="info" text={t('volunteer.free')} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 28 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
