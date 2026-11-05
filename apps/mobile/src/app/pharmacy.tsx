import { useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { isPharmacyListCurrent, pharmaciesFor, type DutyPharmacy } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { FormMessage } from '@/components/form-message';
import { HeroHeader } from '@/components/hero-header';
import { RowIcon, SectionTitle, Tag } from '@/components/inner';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { locationRepository as repo } from '@/lib/locations';
import { useDutyPharmacies } from '@/lib/pharmacies';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

const EDEVLET = 'https://www.turkiye.gov.tr/saglik-titck-nobetci-eczane-sorgulama';

/**
 * Nöbetçi eczane (PROJE.md 5.4, 9.1): ilin bugünkü listesi, kendi ilçen önce; Ara ve Haritada aç. Üstte son güncelleme;
 * liste bugüne ait değilse uyarı ("arayarak teyit edin"); hiç yoksa e-Devlet sorgusu ve 112 notu.
 */
export default function PharmacyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language } = useSettings();
  const { location } = useUserLocation();
  const pc = location?.provinceCode;
  const { day, failed } = useDutyPharmacies(pc);
  const myDistrict = location?.districtId ? repo.getDistrict(location.districtId)?.name : undefined;
  const list = day ? pharmaciesFor(day, myDistrict) : [];
  const current = day ? isPharmacyListCurrent(day) : false;
  const open = (url: string) => Linking.openURL(url).catch(() => {});
  const mapUrl = (p: DutyPharmacy) =>
    p.lat !== undefined && p.lng !== undefined
      ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name}, ${p.address}`)}`;
  const updated = day?.fetchedAt ? new Date(day.fetchedAt).toLocaleString(language ?? 'tr', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';

  let lastDistrict = '';
  return (
    <Screen header={<HeroHeader title={t('pharmacy.title')} subtitle={pc ? repo.getProvince(pc)?.name : undefined} onBack={() => (router.canGoBack() ? router.back() : router.replace('/urgent'))} />}>
      <ScrollView contentContainerStyle={styles.content}>
        {!pc ? <StateMessage kind="empty" message={t('pharmacy.noLocation')} /> : failed ? <StateMessage kind="error" message={t('pharmacy.loadError')} /> : day === undefined ? <StateMessage kind="loading" /> : !day || !list.length ? (
          <View style={{ gap: spacing.md }}>
            <StateMessage kind="empty" message={t('pharmacy.none')} />
            <AppButton variant="secondary" title={t('pharmacy.edevlet')} onPress={() => open(EDEVLET)} />
          </View>
        ) : (
          <>
            <AppText variant="caption" muted>{t('pharmacy.updated', { date: updated })}</AppText>
            {!current ? <FormMessage kind="error" text={t('pharmacy.stale')} /> : null}
            {list.map((p) => {
              const head = p.district !== lastDistrict ? p.district : null;
              lastDistrict = p.district;
              return (
                <View key={`${p.district}-${p.name}`} style={{ gap: spacing.sm }}>
                  {head ? <SectionTitle title={head} aside={myDistrict && head.toLocaleLowerCase('tr') === myDistrict.toLocaleLowerCase('tr') ? t('pharmacy.yourDistrict') : undefined} /> : null}
                  <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                    <View style={styles.row}>
                      <RowIcon icon="local-pharmacy" tint={c.success} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <AppText style={[styles.name, { color: c.textStrong }]}>{p.name}</AppText>
                        <AppText variant="caption" muted selectable>{p.address}</AppText>
                      </View>
                      <Tag label={t('pharmacy.onDuty')} tone="green" />
                    </View>
                    <View style={styles.actions}>
                      {p.phone ? <AppButton title={t('pharmacy.call')} onPress={() => open(`tel:${p.phone!.replace(/[^0-9+]/g, '')}`)} /> : null}
                      <AppButton variant="secondary" title={t('pharmacy.map')} onPress={() => open(mapUrl(p))} />
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}
        <AppText variant="caption" muted>{t('pharmacy.note')}</AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { fontFamily: fonts.bodySemi, fontSize: 16 },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
