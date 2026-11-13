import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '@cityjoy/shared';
import { deleteAllUserData } from '@cityjoy/shared/firebase';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { FormMessage } from '@/components/form-message';
import { FormScreen } from '@/components/form-screen';
import { OptionRow } from '@/components/option-row';
import { TextField } from '@/components/text-field';
import { errorKey } from '@/lib/auth-errors';
import { firestore } from '@/lib/firebase';
import { authService } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings, type AutoplayMode, type ThemeMode } from '@/lib/settings';
import { useSignOut } from '@/lib/sign-out';
import { restartFlow } from '@/lib/navigation';
import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

const APPEARANCE: { mode: ThemeMode; key: string }[] = [
  { mode: 'system', key: 'account.appearanceSystem' },
  { mode: 'light', key: 'account.appearanceLight' },
  { mode: 'dark', key: 'account.appearanceDark' },
];

const AUTOPLAY: AutoplayMode[] = ['wifi', 'her-zaman', 'kapali'];

/** Ayarlar (Profil > ☰; Instagram düzeni): hesap, dil, konum, görünüm, bildirimler, Ailem (SOS), işletme, yasal metinler, çıkış ve hesap silme. */
export default function AccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { user, profile, adopt } = useSession();
  const { language, themeMode, setThemeMode, autoplay, setAutoplay } = useSettings();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const signOut = useSignOut();

  const deleteAccount = async () => {
    setError(undefined);
    setBusy(true);
    try {
      // Kişinin bütün verisi (KVKK; ayrıntı: deleteAllUserData), sonra profil, en son hesap. Web'deki hesap silme sayfası da aynısını yapar.
      await authService.deleteAccountAndData(password || undefined, (uid) => deleteAllUserData(firestore, uid));
      await adopt(null);
      restartFlow(router);
    } catch (e) {
      setError(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen title={t('account.title')}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="subtitle">{profile?.displayName ?? user?.displayName}</AppText>
        <AppText muted>{user?.email}</AppText>
      </View>

      <OptionRow title={t('notifications.settings')} showChevron onPress={() => router.push('/notifications/settings')} />
      <OptionRow title={t('family.title')} subtitle={t('family.hint')} showChevron onPress={() => router.push('/family')} />
      <OptionRow title={t('business.myTitle')} subtitle={t('business.myHint')} showChevron onPress={() => router.push('/business')} />
      <OptionRow title={t('home.changeLanguage')} subtitle={LANGUAGES.find((l) => l.code === language)?.nativeName} showChevron onPress={() => router.push('/language')} />
      <OptionRow title={t('home.changeLocation')} showChevron onPress={() => router.push('/location?edit=1')} />
      <OptionRow title={t('locationBadge.title')} subtitle={profile?.locationCheck ? t(`locationBadge.badge.${profile.locationCheck.level}`) : t('locationBadge.hint')} showChevron onPress={() => router.push('/location-badge')} />

      <AppText variant="label">{t('account.appearance')}</AppText>
      <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup" accessibilityLabel={t('account.appearance')}>
        {APPEARANCE.map((a) => (
          <OptionRow key={a.mode} title={t(a.key)} selected={themeMode === a.mode} onPress={() => setThemeMode(a.mode)} />
        ))}
      </View>

      <AppText variant="label">{t('account.autoplay.title')}</AppText>
      <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup" accessibilityLabel={t('account.autoplay.title')}>
        {AUTOPLAY.map((m) => (
          <OptionRow key={m} title={t('account.autoplay.' + m)} subtitle={m === 'wifi' ? t('account.autoplay.hint') : undefined} selected={autoplay === m} onPress={() => setAutoplay(m)} />
        ))}
      </View>

      <AppText variant="label">{t('account.legal')}</AppText>
      <OptionRow title={t('account.terms')} showChevron onPress={() => router.push('/legal/terms')} />
      <OptionRow title={t('account.privacy')} showChevron onPress={() => router.push('/legal/privacy')} />

      <AppButton variant="secondary" title={t('account.signOut')} onPress={signOut} />

      {/* Hesap silme uygulama içinden yapılır (App Store ve Google Play zorunluluğu). */}
      {confirming ? (
        <View style={{ gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.danger }}>
          <AppText variant="label">{t('account.deleteTitle')}</AppText>
          <AppText muted>{t('account.deleteWarning')}</AppText>
          <TextField label={t('auth.password')} hint={t('account.deletePasswordHint')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
          {error ? <FormMessage kind="error" text={error} /> : null}
          <AppButton title={t('account.deleteConfirm')} onPress={deleteAccount} loading={busy} />
          <AppButton variant="ghost" title={t('account.cancel')} onPress={() => setConfirming(false)} />
        </View>
      ) : (
        <AppButton variant="ghost" title={t('account.deleteAccount')} onPress={() => setConfirming(true)} />
      )}
    </FormScreen>
  );
}
