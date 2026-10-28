import { MaterialIcons } from '@expo/vector-icons';
import { Linking, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ltr, telUrl, type OfficialProfile } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Resmî profil kartı (kurum ya da muhtarlık): rozet, ad, tanıtım, çalışma saatleri, adres ve iletişim düğmeleri.
 * Uygulama aramayı kendiliğinden yapmaz, telefonun arama ekranını açar. Profil yoksa yalnızca ad ve not görünür.
 */
export function OfficialProfileCard({
  title,
  subtitle,
  profile,
  place,
}: {
  title: string;
  subtitle?: string;
  profile: OfficialProfile | null | undefined;
  /** Haritada aramada adrese eklenecek yer adı (ilçe, il). */
  place?: string;
}) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const open = (url: string) => Linking.openURL(url).catch(() => {});
  const p = profile ?? undefined;
  const mapLink = p?.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([title, p.address, place].filter(Boolean).join(', '))}` : undefined;
  const empty = !p || !(p.about || p.phone || p.email || p.website || p.address || p.hours);

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, shadowColor: c.shadow }]}>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: c.accentSoft }]}>
          <MaterialIcons name="verified" size={22} color={c.icon} />
        </View>
        <View style={styles.headText}>
          <AppText accessibilityRole="header" style={[styles.title, { color: c.textStrong }]}>{title}</AppText>
          {subtitle ? <AppText variant="caption" muted>{subtitle}</AppText> : null}
          <AppText variant="caption" style={{ color: c.icon }}>{t('announcements.official')}</AppText>
        </View>
      </View>
      {p?.about ? <AppText selectable>{p.about}</AppText> : null}
      {p?.hours ? (
        <View style={styles.row}>
          <AppText variant="caption" muted>{t('official.hours')}</AppText>
          <AppText>{p.hours}</AppText>
        </View>
      ) : null}
      {p?.address ? (
        <View style={styles.row}>
          <AppText variant="caption" muted>{t('official.address')}</AppText>
          <AppText selectable>{p.address}</AppText>
        </View>
      ) : null}
      {empty ? <AppText variant="caption" muted>{t('official.noInfo')}</AppText> : null}
      <View style={styles.actions}>
        {p?.phone ? <AppButton title={t('city.call', { number: ltr(p.phone) })} onPress={() => open(telUrl(p.phone!))} /> : null}
        {mapLink ? <AppButton variant="secondary" title={t('city.openMap')} onPress={() => open(mapLink)} /> : null}
        {p?.email ? <AppButton variant="secondary" title={t('official.email', { email: ltr(p.email) })} onPress={() => open(`mailto:${p.email}`)} /> : null}
        {p?.website ? <AppButton variant="secondary" title={t('city.website')} onPress={() => open(p.website!)} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, gap: spacing.sm, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 10 },
  head: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  badge: { width: 42, height: 42, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  headText: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 23 },
  row: { gap: 2 },
  actions: { gap: spacing.sm },
});
