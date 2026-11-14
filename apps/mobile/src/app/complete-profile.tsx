import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ageGroup, birthYearError, LEGAL_TEXT_VERSION, type Gender } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { AuthScene, onboardingStyles, StepDots } from '@/components/auth-scene';
import { Chips } from '@/components/chips';
import { CheckboxRow } from '@/components/checkbox-row';
import { FormMessage } from '@/components/form-message';
import { OccupationPicker, useOccupations } from '@/components/occupation-picker';
import { OptionRow } from '@/components/option-row';
import { TextField } from '@/components/text-field';
import { errorKey } from '@/lib/auth-errors';
import { registerForPush } from '@/lib/push';
import { profileRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { restartFlow } from '@/lib/navigation';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

const GENDERS: { value: Gender; key: string }[] = [
  { value: 'kadin', key: 'profile.genderKadin' },
  { value: 'erkek', key: 'profile.genderErkek' },
  { value: 'belirtmek-istemiyorum', key: 'profile.genderNone' },
];

/** Meslek seçilmezse kaydedilen liste kaydı ("Belirtmek istemiyorum"). */
const NO_OCCUPATION = 'belirtmek-istemiyorum';

/**
 * Bildirim izni (G-IzinBildirim; 13. madde 35): örnek bildirimlerle nedenini anlatır, "Devam et" telefonun kendi izin
 * sorusunu açar. Eski "Seni biraz tanıyalım" adımı buraya taşındı: meslek, cinsiyet, kişiye uygun bildirim ve kampanya
 * onayları isteğe bağlı. Profil hiç oluşmadıysa (ör. Google ile giriş) doğum yılı ve zorunlu onaylar da burada alınır.
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
          occupationId: occupationId ?? profile?.occupationId ?? NO_OCCUPATION,
          targeting: consent(targeting),
          // 18 yaş altına kampanya bildirimi gönderilmez.
          commercialMessages: consent(isAdult && commercial),
        },
        current,
      );
      await refreshProfile();
      // İzin verilmese de uygulama çalışır; sonuç beklenmez.
      await registerForPush(user.uid, lang, true).catch(() => {});
      restartFlow(router);
    } catch (e) {
      setError(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  const occupationLabel = occupations?.find((o) => o.id === occupationId)?.name;

  return (
    <AuthScene kind="news" art="permission" logo={false}>
      <StepDots total={3} current={2} label={t('onboarding.step', { n: 3, total: 3 })} />
      <View style={onboardingStyles.texts}>
        <AppText accessibilityRole="header" style={onboardingStyles.title}>{t('onboarding.notifyTitle')}</AppText>
        <AppText style={onboardingStyles.desc}>{t('onboarding.notifyDesc')}</AppText>
      </View>
      <View style={styles.samples} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {(['notifySample1', 'notifySample2', 'notifySample3'] as const).map((k, i) => (
          <View key={k} style={styles.sample}>
            <View style={[styles.sampleIcon, i === 0 && { backgroundColor: c.sos }]}>
              <AppText style={styles.sampleIconText}>{i === 0 ? '!' : 'CJ'}</AppText>
            </View>
            <AppText style={styles.sampleText} numberOfLines={2}>{t(`onboarding.${k}`)}</AppText>
          </View>
        ))}
      </View>

      {needsBasics ? (
        <>
          <TextField label={t('auth.birthYear')} value={birthYear} onChangeText={(v) => {
            setBirthYear(v.replace(/D/g, '').slice(0, 4));
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

      <View style={styles.options}>
        <CheckboxRow checked={targeting} onToggle={() => setTargeting((v) => !v)} label={t('onboarding.targetingConsent')} />
        {targeting ? (
          <>
            <OptionRow title={occupationLabel ?? t('profile.occupation')} subtitle={occupationLabel ? t('profile.occupation') : undefined} showChevron onPress={() => setPickerOpen(true)} />
            <Chips
              label={t('profile.gender')}
              value={gender ?? 'belirtmek-istemiyorum'}
              onChange={(v) => setGender(v)}
              options={GENDERS.map((g) => ({ value: g.value, label: t(g.key) }))}
            />
          </>
        ) : null}
        {isAdult ? <CheckboxRow checked={commercial} onToggle={() => setCommercial((v) => !v)} label={t('profile.commercialConsent')} /> : null}
        <AppText style={onboardingStyles.note}>{t('onboarding.notifyNote')}</AppText>
      </View>

      {error ? <FormMessage kind="error" text={error} /> : null}
      <AppButton title={t('common.continue')} onPress={submit} loading={busy} />

      <OccupationPicker visible={pickerOpen} options={occupations} selectedId={occupationId} onSelect={(id) => {
          setOccupationId(id);
          clearError('occupation');
        }} onClose={() => setPickerOpen(false)} />
    </AuthScene>
  );
}

const styles = StyleSheet.create({
  samples: { gap: 8 },
  sample: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingHorizontal: 12, borderRadius: 18, backgroundColor: 'rgba(243, 246, 246, 0.09)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.06)' },
  sampleIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#E2B277', alignItems: 'center', justifyContent: 'center' },
  sampleIconText: { fontFamily: fonts.heading, fontSize: 12, color: '#081F24', textAlign: 'center' },
  sampleText: { flex: 1, fontSize: 13, lineHeight: 18, color: '#E6ECEC' },
  options: { gap: spacing.md, paddingTop: spacing.sm, borderRadius: radius.lg },
});
