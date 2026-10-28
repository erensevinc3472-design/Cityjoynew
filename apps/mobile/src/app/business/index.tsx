import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Business } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { FormMessage } from '@/components/form-message';
import { FormScreen } from '@/components/form-screen';
import { OptionRow } from '@/components/option-row';
import { StateMessage } from '@/components/state-message';
import { businessRepository } from '@/lib/services';
import { useSession } from '@/lib/session';

/** Profil > İşletmem (PROJE.md 5.6): kullanıcının eklediği ve yetkili olduğu işletmeler; dokununca işletme sayfası açılır. */
export default function MyBusinessesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useSession();
  const [list, setList] = useState<Business[] | null>(null);
  const [managed, setManaged] = useState<Business[]>([]);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    if (!user) return;
    setError(false);
    businessRepository
      .listMine(user.uid)
      .then((l) => setList(l.sort((a, b) => a.name.localeCompare(b.name, 'tr'))))
      .catch(() => setError(true));
    businessRepository.listManaged(user.uid).then(setManaged, () => setManaged([]));
  }, [user]);

  // Düzenleme ekranından dönünce liste tazelenir.
  useFocusEffect(load);

  const statusText = (b: Business) =>
    b.status === 'kaldirildi' ? t('business.statusRemoved') : b.status === 'gizli' ? t('business.statusHidden') : t('business.statusLive');

  return (
    <FormScreen title={t('business.myTitle')}>
      {!user ? (
        <FormMessage kind="info" text={t('business.signInRequired')} />
      ) : error ? (
        <StateMessage kind="error" onRetry={load} />
      ) : list === null ? (
        <StateMessage kind="loading" />
      ) : (
        <>
          {list.length === 0 ? <AppText muted>{t('business.emptyMine')}</AppText> : null}
          {list.map((b) => (
            <OptionRow
              key={b.id}
              title={b.name}
              subtitle={`${statusText(b)} · ${b.verification.status === 'dogrulandi' ? t('business.verified') : t('business.unverified')}`}
              showChevron
              onPress={() => router.push({ pathname: '/business/[id]', params: { id: b.id } })}
            />
          ))}
          {managed.length ? <AppText variant="label" accessibilityRole="header">{t('business.managers.mine')}</AppText> : null}
          {managed.map((b) => (
            <OptionRow key={b.id} title={b.name} subtitle={t('business.managers.youManage')} showChevron onPress={() => router.push({ pathname: '/business/[id]', params: { id: b.id } })} />
          ))}
          <AppButton title={t('business.add')} onPress={() => router.push('/business/edit')} />
          <AppText variant="caption" muted>{t('business.myVerifyNote')}</AppText>
        </>
      )}
    </FormScreen>
  );
}
