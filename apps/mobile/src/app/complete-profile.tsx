import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ageGroup, birthYearError, LEGAL_TEXT_VERSION, type Gender } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { CheckboxRow } from '@/components/checkbox-row';
import { FormMessage } from '@/components/form-message';
import { FormScreen } from '@/components/form-screen';
import { OccupationPicker, useOccupations } from '@/components/occupation-picker';
import { OptionRow } from '@/components/option-row';
import { TextField } from '@/components/text-field';
import { errorKey } from '@/lib/auth-errors';
import { profileRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { restartFlow } from '@/lib/navigation';
import { spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

const GENDERS: { value: Gender; key: string }[] = [
  { value: 'kadin', key: 'profile.genderKadin' },
  { value: 'erkek', key: 'profile.genderErkek' },
  { value: 'belirtmek-istemiyorum', key: 'profile.genderNone' },
];

/**
 * Kayıt sonrası ek bilgiler: cinsiyet (isteğe bağlı), meslek (zorunlu), isteğe bağlı rızalar.
 * Profil hiç oluşmadıysa (ör. Google ile giriş) doğum yılı ve zorunlu onaylar da burada alınır.
 */
export default function CompleteProfileScreen() {
  const { t } = useTranslation();
  const c = useThemeColors();
  const router = useRouter();
  const { user, profile, refreshProfile } = useSession();
  const { language, suggestedLanguage } = useSettings();
  const lang = language ?? suggestedLanguage;
  const occupations = useOccupations(lang);

  const needsBasics = !profile;
  const [birthYear, setBirthYear] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [readPrivacy, setReadPrivacy] = useState(false);
  const [gender, setGender] = useState<Gender | undefined>(profile?.gender);
  const [occupationId, setOccupationId] = useState<string | undefined>(profile?.occupationId);
  const [targeting, setTargeting] = useState(profile?.consents.targeting?.granted ?? false);
  const [commercial, setCommercial] = useState(profile?.consents.commercialMessages?.granted ?? false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const clearError = (key: string) => setErrors((e) => ({ ...e, [key]: '' }));

  const year = profile?.birthYear ?? Number(birthYear);
  const isAdult = Number.isFinite(year) && year > 0 && ageGroup(year) === 'yetiskin';

  const submit = async () => {
    if (!user) return;
    const found: Record<string, string> = {};
    if (needsBasics) {
      const yearError = birthYearError(birthYear);
      if (yearError) found.birthYear = yearError;
      if (!acceptTerms || !readPrivacy) found.acceptTerms = 'errors.mustAccept';
    }
    if (!occupationId) found.occupation = 'errors.required';
    setErrors(found);
    setError(undefined);
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      const now = new Date().toISOString();
      const consent = (granted: boolean) => ({ granted, at: now, textVersion: LEGAL_TEXT_VERSION });
      let current = profile;
      if (!current) {
        await profileRepository.create({
          uid: user.uid,
          displayName: user.displayName ?? user.email ?? '',
          language: lang,
          birthYear: Number(birthYear),
          consents: { terms: consent(true), privacyNotice: consent(true) },
        });
        current = await profileRepository.get(user.uid);
      }
      if (!current) throw new Error('profil oluşturulamadı');
      await profileRepository.update(
        user.uid,
        {
          gender,
          occupationId,
          targeting: consent(targeting),
          // 18 yaş altına kampanya bildirimi gönderilmez.
          commercialMessages: consent(isAdult && commercial),
        },
        current,
      );
      await refreshProfile();
      restartFlow(router);
    } catch (e) {
      setError(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  const occupationLabel = occupations?.find((o) => o.id === occupationId)?.name;

  return (
    <FormScreen title={t('profile.title')} subtitle={t('profile.subtitle')} showBack={false}>
      {needsBasics ? (
        <>
          <TextField label={t('auth.birthYear')} value={birthYear} onChangeText={(v) => {
            setBirthYear(v.replace(/\D/g, '').slice(0, 4));
            clearError('birthYear');
          }} error={errors.birthYear && t(errors.birthYear)} hint={t('auth.birthYearHint')} keyboardType="number-pad" placeholder="1990" maxLength={4} />
          <CheckboxRow checked={acceptTerms} onToggle={() => {
            setAcceptTerms((v) => !v);
            clearError('acceptTerms');
          }} label={t('auth.acceptTerms')} linkLabel={t('auth.read')} onLinkPress={() => router.push('/legal/terms')} />
          <CheckboxRow checked={readPrivacy} onToggle={() => {
            setReadPrivacy((v) => !v);
            clearError('acceptTerms');
          }} label={t('auth.readPrivacy')} linkLabel={t('auth.read')} onLinkPress={() => router.push('/legal/privacy')} />
          {errors.acceptTerms ? <FormMessage kind="error" text={t(errors.acceptTerms)} /> : null}
        </>
      ) : null}

      <View style={{ gap: spacing.xs }}>
        <AppText variant="label">{t('profile.occupation')}</AppText>
        <OptionRow title={occupationLabel ?? t('profile.selectOccupation')} showChevron onPress={() => setPickerOpen(true)} />
        {errors.occupation ? (
          <AppText variant="caption" style={{ color: c.danger }}>{t(errors.occupation)}</AppText>
        ) : (
          <AppText variant="caption" muted>{t('profile.occupationHint')}</AppText>
        )}
      </View>

      <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup" accessibilityLabel={t('profile.gender')}>
        <AppText variant="label">{t('profile.gender')}</AppText>
        {GENDERS.map((g) => (
          <OptionRow key={g.value} title={t(g.key)} selected={gender === g.value} onPress={() => setGender(gender === g.value ? undefined : g.value)} />
        ))}
      </View>

      <View style={{ gap: spacing.md, paddingTop: spacing.sm }}>
        <CheckboxRow checked={targeting} onToggle={() => setTargeting((v) => !v)} label={t('profile.targetingConsent')} />
        {isAdult ? <CheckboxRow checked={commercial} onToggle={() => setCommercial((v) => !v)} label={t('profile.commercialConsent')} /> : null}
      </View>

      {error ? <FormMessage kind="error" text={error} /> : null}
      <AppButton title={t('profile.save')} onPress={submit} loading={busy} />

      <OccupationPicker visible={pickerOpen} options={occupations} selectedId={occupationId} onSelect={(id) => {
          setOccupationId(id);
          clearError('occupation');
        }} onClose={() => setPickerOpen(false)} />
    </FormScreen>
  );
}
