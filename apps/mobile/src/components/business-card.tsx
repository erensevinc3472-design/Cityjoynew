import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { telUrl, whatsappUrl, type Business } from '@cityjoy/shared';

import { locationRepository } from '@/lib/locations';
import { MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';

/** Doğrulama etiketi metni. Rozet "güvenilir" demez, yalnızca belge doğrulamasını ve tarihini söyler (PROJE.md 1.1). */
export function verificationText(b: Business, t: TFunction, language: string): string {
  const v = b.verification;
  if (v.status === 'dogrulandi') {
    return v.verifiedAt
      ? t('business.verifiedOn', { date: new Date(v.verifiedAt).toLocaleDateString(language) })
      : t('business.verified');
  }
  return v.status === 'inceleniyor' ? t('business.reviewing') : t('business.unverified');
}

export function ratingText(b: Business, t: TFunction, language: string): string {
  return b.rating.count
    ? t('business.rating', { avg: b.rating.avg.toLocaleString(language, { maximumFractionDigits: 1 }), count: b.rating.count })
    : t('business.noReviews');
}

/** Hizmet listesindeki işletme kartı: güven bilgisi herkeste aynı ve ücretsiz görünür (Karar, Eren). */
export function BusinessCard({ business: b, featured }: { business: Business; featured?: boolean }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const verified = b.verification.status === 'dogrulandi';
  const district = locationRepository.getDistrict(b.location.districtId)?.name;

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: featured ? c.accentBorder : c.border, shadowColor: c.shadow }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[featured ? t('business.ad') : null, b.name, verificationText(b, t, i18n.language), ratingText(b, t, i18n.language), district].filter(Boolean).join(', ')}
        onPress={() => router.push({ pathname: '/business/[id]', params: { id: b.id } })}
        style={({ pressed }) => [styles.body, { opacity: pressed ? 0.8 : 1 }]}>
        {featured ? (
          <View style={[styles.adTag, { borderColor: c.accentBorder }]}>
            <AppText variant="caption" style={{ color: c.highlight }}>{t('business.ad')}</AppText>
          </View>
        ) : null}
        <AppText variant="label">{b.name}</AppText>
        <View style={styles.line}>
          <MaterialIcons name={verified ? 'verified' : 'help-outline'} size={16} color={verified ? c.success : c.textMuted} />
          <AppText variant="caption" style={{ color: verified ? c.success : c.textMuted }}>{verificationText(b, t, i18n.language)}</AppText>
        </View>
        <View style={styles.line}>
          <MaterialIcons name="star" size={16} color={b.rating.count ? c.highlight : c.textSoft} />
          <AppText variant="caption" muted>{ratingText(b, t, i18n.language)}</AppText>
        </View>
        <View style={styles.line}>
          <MaterialIcons name="place" size={16} color={c.textMuted} />
          <AppText variant="caption" muted>{[district, b.is24h ? t('business.open24') : b.hoursNote].filter(Boolean).join(' · ')}</AppText>
        </View>
      </Pressable>
      <ContactButtons business={b} />
    </View>
  );
}

/** Arama ve WhatsApp: uygulama içi yazışma yok, iletişim kullanıcı ile işletme arasında (PROJE.md 1.1). */
export function ContactButtons({ business: b }: { business: Business }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const open = (url: string) => Linking.openURL(url).catch(() => {});
  const buttons = [
    { key: 'call', icon: 'call' as const, label: t('business.call'), a11y: t('business.callLabel', { name: b.name }), url: telUrl(b.phone) },
    ...(b.whatsapp
      ? [{ key: 'wa', icon: 'chat' as const, label: t('business.whatsappBtn'), a11y: t('business.whatsappLabel', { name: b.name }), url: whatsappUrl(b.phone) }]
      : []),
  ];
  return (
    <View style={[styles.actions, { borderTopColor: c.border }]}>
      {buttons.map((btn) => (
        <Pressable
          key={btn.key}
          accessibilityRole="button"
          accessibilityLabel={btn.a11y}
          onPress={() => open(btn.url)}
          style={({ pressed }) => [styles.action, { opacity: pressed ? 0.7 : 1 }]}>
          <MaterialIcons name={btn.icon} size={20} color={c.primary} />
          <AppText style={{ color: c.primary }}>{btn.label}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8 },
  body: { padding: spacing.md, gap: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  adTag: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, marginBottom: 2 },
  actions: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  action: { flex: 1, minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
});
