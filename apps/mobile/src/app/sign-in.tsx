import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isValidEmail, type AuthUser } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AuthLink, AuthScene, GlassCard, OrDivider, SocialButton } from '@/components/auth-scene';
import { FormMessage } from '@/components/form-message';
import { TextField } from '@/components/text-field';
import { errorKey } from '@/lib/auth-errors';
import { authService, supportsGoogleSignIn } from '@/lib/services';
import { useSession } from '@/lib/session';
import { restartFlow } from '@/lib/navigation';

/** Giriş (G-Giris): sahne üstünde buzlu cam kart. Apple ile giriş geliştirme derlemesiyle eklenecek (Expo Go desteklemez). */
export default function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { adopt } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<AuthUser>) => {
    setError(undefined);
    setBusy(true);
    try {
      await adopt(await fn());
      // Yönlendirmeyi açılış ekranı yapar (profil eksikse tamamlama ekranına gider).
      restartFlow(router);
    } catch (e) {
      setError(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (!isValidEmail(email) || !password) {
      setError(t('errors.wrongCredentials'));
      return;
    }
    run(() => authService.signIn(email, password));
  };

  return (
    <AuthScene glass kind="cover">
      <GlassCard title={t('auth.signInTitle')} subtitle={t('auth.signInSubtitle')}>
        <TextField label={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
        <TextField label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={submit} />
        <AuthLink lead="" action={t('auth.forgotPasswordShort')} onPress={() => router.push({ pathname: '/reset-password', params: { email } })} />
        {error ? <FormMessage kind="error" text={error} /> : null}
        <AppButton title={t('auth.signIn')} onPress={submit} loading={busy} />
        {supportsGoogleSignIn ? (
          <>
            <OrDivider label={t('auth.or')} />
            <SocialButton icon="google" title={t('auth.google')} onPress={() => run(() => authService.signInWithGoogle())} disabled={busy} />
          </>
        ) : null}
      </GlassCard>
      <AuthLink lead={t('auth.noAccountLead')} action={t('auth.signUp')} onPress={() => router.replace('/sign-up')} />
    </AuthScene>
  );
}
