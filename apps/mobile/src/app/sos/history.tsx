import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SosAlert } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { FormScreen } from '@/components/form-screen';
import { OptionRow } from '@/components/option-row';
import { StateMessage } from '@/components/state-message';
import { sosRepository } from '@/lib/services';
import { useSession } from '@/lib/session';

/** Gönderdiğim SOS'lar (son 30). Kayıtlar 30 gün sonra kendiliğinden silinir. */
export default function SosHistoryScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useSession();
  const [list, setList] = useState<SosAlert[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    if (!user) return;
    setError(false);
    sosRepository.listSent(user.uid).then(setList).catch(() => setError(true));
  }, [user]);
  useFocusEffect(load);

  const status = (a: SosAlert) =>
    ({ aktif: t('sos.statusActive'), guvende: t('sos.statusSafe'), bitti: t('sos.statusEnded') })[a.status];

  return (
    <FormScreen title={t('sos.history')}>
      {error ? (
        <StateMessage kind="error" onRetry={load} />
      ) : list === null ? (
        <StateMessage kind="loading" />
      ) : list.length === 0 ? (
        <AppText muted>{t('sos.historyEmpty')}</AppText>
      ) : (
        list.map((a) => (
          <OptionRow
            key={a.id}
            title={`${a.test ? `${t('sos.testBadge')} · ` : ''}${new Date(a.createdAt).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })}`}
            subtitle={status(a)}
            showChevron
            onPress={() => router.push({ pathname: '/sos/[id]', params: { id: a.id } })}
          />
        ))
      )}
      <AppText variant="caption" muted>{t('sos.historyNote')}</AppText>
    </FormScreen>
  );
}
