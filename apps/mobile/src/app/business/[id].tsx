import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { findCategory, localized, type Business } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { ContactButtons, ratingText, verificationText } from '@/components/business-card';
import { HeroHeader } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { locationRepository } from '@/lib/locations';
import { useServiceCategories } from '@/lib/service-categories';
import { businessRepository } from '@/lib/services';
import { useSettings } from '@/lib/settings';
import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * İşletme sayfası: güven bilgisi (doğrulama, puan, saatler, iletişim) herkese ücretsiz; fiyat listesi
 * "tahmini" notu ve son güncelleme tarihiyle (PROJE.md 1.1). Fotoğraf ve video vitrini sonraki adımda.
 */
export default function BusinessScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const { id } = useLocalSearchParams<{ id: string }>();
  const { all } = useServiceCategories();
  const [b, setB] = useState<Business | null | undefined>(undefined);
  const [error, setError] = useState(false);

  const load = () => {
    setError(false);
    businessRepository.get(id).then(setB).catch(() => setError(true));
  };
  useEffect(load, [id]);

  const header = <HeroHeader title={b?.name ?? ''} onBack={() => (router.canGoBack() ? router.back() : router.replace('/urgent'))} />;
  if (error || b === null || (b && b.status !== 'yayinda')) {
    return (
      <Screen header={header}>
        {error ? <StateMessage kind="error" onRetry={load} /> : <StateMessage kind="empty" message={t('business.notFound')} />}
      </Screen>
    );
  }
  if (!b) {
    return (
      <Screen header={header}>
        <StateMessage kind="loading" />
      </Screen>
    );
  }

  const verified = b.verification.status === 'dogrulandi';
  const place = [b.address, locationRepository.getDistrict(b.location.districtId)?.name, locationRepository.getProvince(b.location.provinceCode)?.name]
    .filter(Boolean)
    .join(', ');
  const date = (iso: string) => new Date(iso).toLocaleDateString(i18n.language);
  const services = b.categoryIds.map((cid) => findCategory(all, cid)).filter(Boolean).map((cat) => localized(cat!.names, lang));

  const Info = ({ icon, label, value, color }: { icon: IconName; label?: string; value: string; color?: string }) => (
    <View style={styles.info}>
      <MaterialIcons name={icon} size={20} color={color ?? c.textMuted} />
      <View style={styles.flex}>
        {label ? <AppText variant="caption" muted>{label}</AppText> : null}
        <AppText style={color ? { color } : undefined}>{value}</AppText>
      </View>
    </View>
  );

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.cardBody}>
            <Info icon={verified ? 'verified' : 'help-outline'} value={verificationText(b, t, i18n.language)} color={verified ? c.success : undefined} />
            <Info icon="star" value={ratingText(b, t, i18n.language)} />
            {services.length ? <Info icon="handyman" label={t('business.servicesLabel')} value={services.join(', ')} /> : null}
            <Info icon="schedule" label={t('business.hoursLabel')} value={b.is24h ? t('business.open24') : (b.hoursNote ?? '-')} />
            <Info icon="place" label={t('business.addressLabel')} value={place} />
          </View>
          <ContactButtons business={b} />
        </View>

        {b.description ? <AppText>{b.description}</AppText> : null}

        {b.priceList.length ? (
          <View style={[styles.card, styles.cardBody, { backgroundColor: c.surface, borderColor: c.border }]}>
            <AppText variant="label" accessibilityRole="header">{t('business.priceListTitle')}</AppText>
            {b.priceList.map((p, i) => (
              <View key={i} style={[styles.price, { borderTopColor: c.border }]}>
                <AppText style={styles.flex}>{p.name}</AppText>
                <AppText variant="label">{p.price}</AppText>
              </View>
            ))}
            <AppText variant="caption" muted>{t('business.priceNote')}</AppText>
          </View>
        ) : null}

        {!verified ? <AppText variant="caption" muted>{t('business.unverifiedWarning')}</AppText> : null}
        <AppText variant="caption" muted>{t('business.updated', { date: date(b.updatedAt) })}</AppText>
        <AppText variant="caption" muted>{t('business.infoOnly')}</AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  flex: { flex: 1 },
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  cardBody: { padding: spacing.md, gap: spacing.sm },
  info: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  price: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
});
