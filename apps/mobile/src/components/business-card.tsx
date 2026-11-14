import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { averageRating, hasPublicPage, isProBusiness, telUrl, whatsappUrl, type Business } from '@cityjoy/shared';

import { ThumbImage } from '@/components/thumb-image';
import { locationRepository } from '@/lib/locations';
import { reviewRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';
import { ReviewsSheet } from './reviews-sheet';

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
    ? t('business.rating', { avg: averageRating(b.rating).toLocaleString(language, { maximumFractionDigits: 1 }), count: b.rating.count })
    : t('business.noReviews');
}

/** Kartta "Pro" etiketi: ücretli kademe öne geçtiği için açıkça yazılır (gizli sıralama yok; Karar Eren, 7 Kasım). */
export function ProTag() {
  const { t } = useTranslation();
  const c = useThemeColors();
  return (
    <View style={[styles.proTag, { backgroundColor: c.accentSoft, borderColor: c.accentBorder }]}>
      <AppText variant="caption" style={[styles.proText, { color: c.primary }]}>{t('business.pro')}</AppText>
    </View>
  );
}

/**
 * Hizmet listesindeki işletme kartı: güven bilgisi herkeste aynı ve ücretsiz görünür (Karar, Eren).
 * Kademeler (Karar Eren, 7 Kasım 2026): doğrulanmış işletmenin kartı sayfasına götürür (sağda ok); doğrulanmamış
 * işletmenin sayfası dışarıya kapalı, kart dokununca yerinde açılır: bilgiler, uyarı, yorumlar, Ara ve WhatsApp.
 */
/** showProvince: Türkiye geneli aramada ilçenin yanında il de yazar (aynı adlı işletmeler karışmasın). */
export function BusinessCard({ business: b, featured, initiallyOpen, showProvince }: { business: Business; featured?: boolean; initiallyOpen?: boolean; showProvince?: boolean }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { user } = useSession();
  const verified = b.verification.status === 'dogrulandi';
  const pro = isProBusiness(b);
  const team = !!user && (b.ownerUid === user.uid || b.managers.some((m) => m.uid === user.uid));
  const page = hasPublicPage(b) || team;
  const [open, setOpen] = useState(!!initiallyOpen);
  const [reviews, setReviews] = useState(false);
  const districtName = locationRepository.getDistrict(b.location.districtId)?.name;
  const district = showProvince ? [districtName, locationRepository.getProvince(b.location.provinceCode)?.name].filter(Boolean).join(', ') : districtName;
  const place = [district, b.is24h ? t('business.open24') : b.hoursNote].filter(Boolean).join(' · ');
  const label = [featured ? t('business.ad') : null, pro ? t('business.pro') : null, b.name, verificationText(b, t, i18n.language), ratingText(b, t, i18n.language), district]
    .filter(Boolean)
    .join(', ');

  if (!page) {
    // Doğrulanmamış: kapalıyken ad, "Doğrulanmadı" ve puan; dokununca kart büyür.
    return (
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, shadowColor: c.shadow }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={t('business.card.expandHint')}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((v) => !v)}
          style={({ pressed }) => [styles.compact, { opacity: pressed ? 0.8 : 1 }]}>
          <View style={styles.grow}>
            <AppText variant="label" numberOfLines={open ? undefined : 1}>{b.name}</AppText>
            <View style={styles.line}>
              <MaterialIcons name="help-outline" size={15} color={c.textMuted} />
              <AppText variant="caption" muted>{verificationText(b, t, i18n.language)}</AppText>
              {b.rating.count ? (
                <>
                  <MaterialIcons name="star" size={15} color={c.highlight} />
                  <AppText variant="caption" muted>{ratingText(b, t, i18n.language)}</AppText>
                </>
              ) : null}
            </View>
          </View>
          <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={24} color={c.textSoft} />
        </Pressable>
        {open ? (
          <>
            <View style={styles.details}>
              {place ? (
                <View style={styles.line}>
                  <MaterialIcons name="place" size={16} color={c.textMuted} />
                  <AppText variant="caption" muted>{place}</AppText>
                </View>
              ) : null}
              {b.description ? <AppText variant="caption" numberOfLines={4}>{b.description}</AppText> : null}
              <View style={[styles.warn, { backgroundColor: c.surfaceStrong }]}>
                <MaterialIcons name="info-outline" size={16} color={c.textMuted} />
                <AppText variant="caption" muted style={styles.grow}>{t('business.unverifiedWarning')}</AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setReviews(true)}
                hitSlop={6}
                style={({ pressed }) => [styles.line, styles.link, { opacity: pressed ? 0.7 : 1 }]}>
                <MaterialIcons name="rate-review" size={16} color={c.primary} />
                <AppText variant="caption" style={{ color: c.primary }}>
                  {b.rating.count ? t('business.card.seeReviews', { count: b.rating.count }) : t('business.card.reviewsEmpty')}
                </AppText>
              </Pressable>
            </View>
            <ContactButtons business={b} />
            <ReviewsSheet business={b} open={reviews} onClose={() => setReviews(false)} />
          </>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: featured ? c.accentBorder : c.border, shadowColor: c.shadow }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t('business.card.openHint')}
        onPress={() => router.push({ pathname: '/business/[id]', params: { id: b.id } })}
        style={({ pressed }) => [styles.body, styles.withArrow, b.logo ? styles.withLogo : null, { opacity: pressed ? 0.8 : 1 }]}>
        {b.logo ? <ThumbImage photo={b.logo} style={[styles.logo, { backgroundColor: c.surfaceStrong }]} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
        <MaterialIcons name="chevron-right" size={24} color={c.textSoft} style={styles.arrow} />
        {featured || pro ? (
          <View style={styles.tags}>
            {featured ? (
              <View style={[styles.adTag, { borderColor: c.accentBorder }]}>
                <AppText variant="caption" style={{ color: c.highlight }}>{t('business.ad')}</AppText>
              </View>
            ) : null}
            {pro ? <ProTag /> : null}
          </View>
        ) : null}
        <AppText variant="label">{b.name}</AppText>
        <View style={styles.line}>
          <MaterialIcons name={verified ? 'verified' : 'help-outline'} size={16} color={verified ? c.success : c.textMuted} />
          <AppText variant="caption" style={{ color: verified ? c.success : c.textMuted }}>{verificationText(b, t, i18n.language)}</AppText>
        </View>
        {b.rating.count ? (
          <View style={styles.line}>
            <MaterialIcons name="star" size={16} color={c.highlight} />
            <AppText variant="caption" muted>{ratingText(b, t, i18n.language)}</AppText>
          </View>
        ) : (
          // Puan yalnızca gerçek oyla; oyu olmayan işletme "Yeni" (13. madde 35).
          <View style={[styles.newTag, { backgroundColor: c.accentSoft }]}>
            <AppText variant="caption" style={{ color: c.primary }}>{t('business.new')}</AppText>
          </View>
        )}
        <View style={styles.line}>
          <MaterialIcons name="place" size={16} color={c.textMuted} />
          <AppText variant="caption" muted>{place}</AppText>
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
  const { user } = useSession();
  // Giriş yapmış kişinin araması kaydedilir: değerlendirme yazabilmenin şartı (PROJE.md 13 madde 17).
  const open = (url: string) => {
    if (user && user.uid !== b.ownerUid) reviewRepository.recordContact(b.id, user.uid).catch(() => {});
    Linking.openURL(url).catch(() => {});
  };
  const buttons = [
    { key: 'call', icon: 'call' as const, label: t('business.call'), a11y: t('business.callLabel', { name: b.name }), url: telUrl(b.phone) },
    ...(b.whatsapp
      ? [{ key: 'wa', icon: 'chat' as const, label: t('business.whatsappBtn'), a11y: t('business.whatsappLabel', { name: b.name }), url: whatsappUrl(b.phone) }]
      : []),
    // Yol tarifi: adres ya da konum varsa (harita uygulaması açılır).
    ...(b.geo || b.address
      ? [{
          key: 'map',
          icon: 'directions' as const,
          label: t('business.directions'),
          a11y: t('business.directionsLabel', { name: b.name }),
          url: b.geo
            ? `https://www.google.com/maps/dir/?api=1&destination=${b.geo.lat},${b.geo.lng}`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.name}, ${b.address}`)}`,
        }]
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
  withLogo: { paddingEnd: spacing.md + 52 + 24 },
  withArrow: { paddingEnd: spacing.md + 24 },
  arrow: { position: 'absolute', end: spacing.sm, top: '50%', marginTop: -12 },
  tags: { flexDirection: 'row', gap: spacing.xs, marginBottom: 2 },
  proTag: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm },
  proText: { fontWeight: '700' },
  compact: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, minHeight: MIN_TOUCH },
  grow: { flex: 1, gap: 2 },
  details: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  warn: { flexDirection: 'row', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.sm, alignItems: 'flex-start' },
  link: { alignSelf: 'flex-start', minHeight: 32 },
  logo: { position: 'absolute', top: spacing.md, end: spacing.md + 24, width: 44, height: 44, borderRadius: 22 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  newTag: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 1 },
  adTag: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm },
  actions: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  action: { flex: 1, minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
});
