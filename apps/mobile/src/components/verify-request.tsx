import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Approval, Business } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { FormMessage } from '@/components/form-message';
import { verificationRequests } from '@/lib/services';

/**
 * İşletme sayfasında doğrulama isteği: sahibi tek dokunuşla ister; istek panelde "Bekleyen onaylar"a düşer, admin
 * onaylar. İstek bekliyorsa "Talebiniz alındı" yazar; reddedildiyse gerekçe ve "Yeniden iste" görünür. Yetkililer
 * yalnızca durumu görür. Düğmenin görünümü sayfadan gelir (`button`).
 */
export function VerifyRequest({
  business,
  uid,
  isOwner,
  button,
  onSent,
}: {
  business: Business;
  uid: string;
  isOwner: boolean;
  button: (label: string, onPress: () => void, busy: boolean) => ReactNode;
  onSent?: () => void;
}) {
  const { t } = useTranslation();
  const [request, setRequest] = useState<Approval | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    verificationRequests.get(business.id).then(setRequest).catch(() => setRequest(null));
  }, [business.id]);
  useEffect(load, [load]);

  const send = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await verificationRequests.request(uid, business);
      load();
      onSent?.();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  if (request === undefined) return null;
  const pending = request?.status === 'il-onayi-bekliyor' || request?.status === 'admin-onayi-bekliyor';
  if (pending) return <FormMessage kind="info" text={t('business.tiers.requestSent')} />;
  return (
    <>
      {request?.status === 'reddedildi' ? (
        <FormMessage kind="error" text={t('business.verifyRejected', { reason: request.decision?.reason ?? '' })} />
      ) : (
        <AppText variant="caption" muted>{t('business.tiers.unverifiedBody')}</AppText>
      )}
      {failed ? <FormMessage kind="error" text={t('business.tiers.requestFailed')} /> : null}
      {isOwner ? button(request ? t('business.verifyAgain') : t('business.tiers.requestVerification'), send, busy) : null}
    </>
  );
}
