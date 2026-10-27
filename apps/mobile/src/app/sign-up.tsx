import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LEGAL_TEXT_VERSION, MIN_PASSWORD_LENGTH, validateSignUp, type SignUpErrors, type SignUpInput } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { CheckboxRow } from '@/components/checkbox-row';
import { FormMessage } from '@/components/form-message';
import { FormScreen } from '@/components/form-screen';
import { TextField } from '@/components/text-field';
import { errorKey } from '@/lib/auth-errors';
import { authService, profileRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { restartFlow } from '@/lib/navigation';
import { spacing } from '@/theme/tokens';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { language, suggestedLanguage } = useSettings();
  const { adopt } = useSession();
  const [form, setForm] = useState<SignUpInput>({
    fullName: '',
    email: '',
    password: '',
    passwordRepeat: '',
    birthYear: '',
    acceptTerms: false,
    readPrivacy: false,
  });
  const [errors, setErrors] = useState<SignUpErrors>({});
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof SignUpInput>(key: K, value: SignUpInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    // Düzeltilen alanın hatası hemen kalkar; onay kutuları tek hata metnini paylaşır.
    const errorKey = key === 'readPrivacy' ? 'acceptTerms' : key === 'password' ? 'passwordRepeat' : key;
    setErrors((e) => ({ ...e, [key]: undefined, [errorKey]: undefined }));
  };
  const err = (key: keyof SignUpInput) => (errors[key] ? t(errors[key]!, { count: MIN_PASSWORD_LENGTH }) : undefined);

  const submit = async () => {
    const found = validateSignUp(form);
    setErrors(found);
    setError(undefined);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const user = await authService.signUp(form.email, form.password, form.fullName);
      const now = new Date().toISOString();
      const consent = { granted: true, at: now, textVersion: LEGAL_TEXT_VERSION };
      await profileRepository.create({
        uid: user.uid,
        displayName: form.fullName,
        language: language ?? suggestedLanguage,
        birthYear: Number(form.birthYear),
        consents: { terms: consent, privacyNotice: consent },
      });
      await adopt(user);
      restartFlow(router);
    } catch (e) {
      setError(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen title={t('auth.signUp')}>
      <TextField label={t('auth.fullName')} value={form.fullName} onChangeText={(v) => set('fullName', v)} error={err('fullName')} autoComplete="name" textContentType="name" />
      <TextField label={t('auth.email')} value={form.email} onChangeText={(v) => set('email', v)} error={err('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
      <TextField label={t('auth.password')} value={form.password} onChangeText={(v) => set('password', v)} error={err('password')} hint={t('auth.passwordHint', { count: MIN_PASSWORD_LENGTH })} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
      <TextField label={t('auth.passwordRepeat')} value={form.passwordRepeat} onChangeText={(v) => set('passwordRepeat', v)} error={err('passwordRepeat')} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
      <TextField label={t('auth.birthYear')} value={form.birthYear} onChangeText={(v) => set('birthYear', v.replace(/\D/g, '').slice(0, 4))} error={err('birthYear')} hint={t('auth.birthYearHint')} keyboardType="number-pad" placeholder="1990" maxLength={4} />
      <View style={{ gap: spacing.md, paddingTop: spacing.sm }}>
        <CheckboxRow checked={form.acceptTerms} onToggle={() => set('acceptTerms', !form.acceptTerms)} label={t('auth.acceptTerms')} linkLabel={t('auth.read')} onLinkPress={() => router.push('/legal/terms')} />
        <CheckboxRow checked={form.readPrivacy} onToggle={() => set('readPrivacy', !form.readPrivacy)} label={t('auth.readPrivacy')} linkLabel={t('auth.read')} onLinkPress={() => router.push('/legal/privacy')} />
        {errors.acceptTerms ? <FormMessage kind="error" text={t(errors.acceptTerms)} /> : null}
      </View>
      {error ? <FormMessage kind="error" text={error} /> : null}
      <AppButton title={t('auth.signUp')} onPress={submit} loading={busy} />
      <AppButton variant="ghost" title={t('auth.haveAccount')} onPress={() => router.replace('/sign-in')} />
    </FormScreen>
  );
}
