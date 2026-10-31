import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isValidSuggestion, SUGGESTION_MAX } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { FormMessage } from '@/components/form-message';
import { FormScreen } from '@/components/form-screen';
import { TextField } from '@/components/text-field';
import { sendServiceSuggestion } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useUserLocation } from '@/lib/user-location';
import { errorText } from '@/lib/limits';

/** "Eksik hizmet mi var? Bildir" (PROJE.md 5.4). Öneri panelde "Eksik hizmet önerileri" bölümüne düşer. */
export default function SuggestServiceScreen() {
  const { t } = useTranslation();
  const { user } = useSession();
  const { location } = useUserLocation();
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (!isValidSuggestion(text)) return setError(t('services.suggestTooShort'));
    setError(undefined);
    setBusy(true);
    try {
      await sendServiceSuggestion(user.uid, text, location?.provinceCode);
      setSent(true);
      setText('');
    } catch (e) {
      setError(errorText(t, e, 'services.suggestError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen title={t('services.suggestTitle')} subtitle={t('services.suggestIntro')}>
      {!user ? <FormMessage kind="info" text={t('services.suggestSignIn')} /> : null}
      {sent ? <FormMessage kind="info" text={t('services.suggestThanks')} /> : null}
      {error ? <FormMessage kind="error" text={error} /> : null}
      <TextField
        label={t('services.suggestLabel')}
        hint={t('services.suggestHint')}
        value={text}
        onChangeText={(v) => {
          setText(v);
          setSent(false);
        }}
        maxLength={SUGGESTION_MAX}
        multiline
        editable={!!user}
      />
      <AppButton title={t('services.suggestSend')} onPress={submit} loading={busy} disabled={!user || busy} />
    </FormScreen>
  );
}
