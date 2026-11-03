import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { FormMessage } from '@/components/form-message';
import { FormScreen } from '@/components/form-screen';
import { checkMyLocation, type BadgeCheck } from '@/lib/location-badge';
import { rememberProfile } from '@/lib/profile-photos';
import { profileRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Konum rozeti (PROJE.md 5.5 madde 5): isteyen kişi konumunu bir kez doğrular, Keşfet profilinde ve gönderilerinde
 * "Mahallesi doğrulandı" (ya da "İlçesi doğrulandı") rozeti görünür. Koordinat saklanmaz, mahallenin adı görünmez.
 * Mahalle değişince rozet düşer; kişi istediği an kaldırır.
 */
export default function LocationBadgeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language } = useSettings();
  const { user, profile, refreshProfile } = useSession();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BadgeCheck | 'error' | null>(null);
  const check = profile?.locationCheck;
  const loc = profile?.location;

  if (!user || !profile) return <FormScreen title={t('locationBadge.title')}><FormMessage kind="info" text={t('locationBadge.signIn')} /></FormScreen>;

  const verify = async () => {
    if (!loc?.districtId) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await checkMyLocation(loc);
      setResult(r);
      if (r === 'mahalle' || r === 'ilce') {
        await profileRepository.setLocationCheck(user.uid, { level: r, neighbourhoodId: loc.neighbourhoodId ?? '' });
        rememberProfile(user.uid, { locationVerified: r });
        await refreshProfile();
      }
    } catch {
      setResult('error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    setResult(null);
    try {
      await profileRepository.setLocationCheck(user.uid, null);
      rememberProfile(user.uid, { locationVerified: undefined });
      await refreshProfile();
    } catch {
      setResult('error');
    } finally {
      setBusy(false);
    }
  };

  const message =
    result === 'mahalle' || result === 'ilce'
      ? { kind: 'info' as const, text: t(`locationBadge.done.${result}`) }
      : result
        ? { kind: 'error' as const, text: t(`locationBadge.fail.${result}`) }
        : null;

  return (
    <FormScreen title={t('locationBadge.title')} subtitle={t('locationBadge.intro')}>
      <View style={[styles.status, { backgroundColor: c.surface, borderColor: check ? c.accent : c.border }]}>
        <MaterialIcons name={check ? 'where-to-vote' : 'location-off'} size={28} color={check ? c.accent : c.textMuted} />
        <View style={styles.statusText}>
          <AppText variant="label">{check ? t(`locationBadge.badge.${check.level}`) : t('locationBadge.none')}</AppText>
          {check?.at ? (
            <AppText variant="caption" muted>{t('locationBadge.at', { date: new Date(check.at).toLocaleDateString(language ?? 'tr', { dateStyle: 'medium' }) })}</AppText>
          ) : null}
        </View>
      </View>

      {!loc?.districtId ? (
        <>
          <FormMessage kind="info" text={t('locationBadge.needLocation')} />
          <AppButton title={t('home.changeLocation')} onPress={() => router.push('/location?edit=1')} />
        </>
      ) : (
        <AppButton title={check ? t('locationBadge.again') : t('locationBadge.verify')} onPress={verify} loading={busy} disabled={busy} />
      )}
      {message ? <FormMessage kind={message.kind} text={message.text} /> : null}
      {check ? <AppButton variant="ghost" title={t('locationBadge.remove')} onPress={remove} disabled={busy} /> : null}

      <View style={styles.notes}>
        {(['how', 'privacy', 'change', 'limit'] as const).map((k) => (
          <AppText key={k} variant="caption" muted>• {t(`locationBadge.notes.${k}`)}</AppText>
        ))}
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  statusText: { flex: 1, gap: 2 },
  notes: { gap: spacing.xs },
});
