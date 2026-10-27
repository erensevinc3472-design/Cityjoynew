import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isValidEmail } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { FormMessage } from '@/components/form-message';
import { FormScreen } from '@/components/form-screen';
import { TextField } from '@/components/text-field';
import { errorKey } from '@/lib/auth-errors';
import { authService } from '@/lib/services';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(undefined);
    if (!isValidEmail(email)) {
      setError(t('errors.invalidEmail'));
      return;
    }
    setBusy(true);
    try {
      await authService.sendPasswordReset(email);
      setSent(true);
    } catch (e) {
      // Hesabın var olup olmadığı belli edilmez; yalnızca ağ ve sınır hataları gösterilir.
      const key = errorKey(e);
      if (key === 'errors.network' || key === 'errors.tooManyRequests' || key === 'errors.invalidEmail') setError(t(key));
      else setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen title={t('reset.title')} subtitle={t('reset.subtitle')}>
      <TextField label={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      {error ? <FormMessage kind="error" text={error} /> : null}
      {sent ? <FormMessage kind="info" text={t('reset.sent')} /> : null}
      <AppButton title={t('reset.send')} onPress={submit} loading={busy} />
    </FormScreen>
  );
}
