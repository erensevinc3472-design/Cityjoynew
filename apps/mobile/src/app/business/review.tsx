import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authorNameOf, isValidReviewText, isValidStars, REVIEW_TEXT } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { FormMessage } from '@/components/form-message';
import { FormScreen } from '@/components/form-screen';
import { Stars } from '@/components/stars';
import { StateMessage } from '@/components/state-message';
import { TextField } from '@/components/text-field';
import { goBackOr } from '@/lib/navigation';
import { reviewRepository } from '@/lib/services';
import { useSession } from '@/lib/session';

/** Değerlendirme yaz / düzenle / sil. Puan toplamı aynı işlemde güncellenir (kurallar denetler). */
export default function ReviewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useSession();
  const [ready, setReady] = useState(false);
  const [exists, setExists] = useState(false);
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    reviewRepository
      .getMine(id, user.uid)
      .then((r) => {
        if (r) {
          setExists(true);
          setStars(r.stars);
          setText(r.text);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [id, user]);

  if (!user) {
    return (
      <FormScreen title={t('reviews.write')}>
        <FormMessage kind="info" text={t('reviews.signIn')} />
      </FormScreen>
    );
  }
  if (!ready) {
    return (
      <FormScreen title={t('reviews.write')}>
        <StateMessage kind="loading" />
      </FormScreen>
    );
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
      goBackOr(router, { pathname: '/business/[id]', params: { id } });
    } catch {
      setError(t('reviews.error'));
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (!isValidStars(stars)) return setError(t('reviews.starsRequired'));
    if (!isValidReviewText(text)) return setError(t('reviews.textInvalid'));
    run(() => reviewRepository.save(id, user.uid, { stars, text }, authorNameOf(profile?.displayName ?? user.displayName)));
  };

  return (
    <FormScreen title={exists ? t('reviews.edit') : t('reviews.write')}>
      {error ? <FormMessage kind="error" text={error} /> : null}
      <AppText variant="label">{t('reviews.starsLabel')}</AppText>
      <Stars value={stars} size={32} onChange={setStars} />
      <TextField label={t('reviews.textLabel')} hint={t('reviews.textHint')} value={text} onChangeText={setText} maxLength={REVIEW_TEXT[1]} multiline />
      <AppButton title={t('reviews.send')} onPress={submit} loading={busy} disabled={busy} />
      {exists ? <AppButton variant="ghost" title={t('reviews.delete')} disabled={busy} onPress={() => run(() => reviewRepository.delete(id, user.uid))} /> : null}
      <AppText variant="caption" muted>{t('reviews.rules')}</AppText>
    </FormScreen>
  );
}
