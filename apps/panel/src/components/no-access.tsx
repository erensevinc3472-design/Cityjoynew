import { useState } from 'react';

import { authService } from '../lib/services';
import { useSession } from '../lib/session';
import { t } from '../lib/t';

/**
 * Yetkisi olmayan hesap (PROJE.md 6.7): form yok. Yetkiyi kurumun yetkilisi, il yöneticisi ya da CityJoy kişinin
 * e-postasına verir; kişi o e-postayla girince panel açılır. Yetki yalnızca doğrulanmış e-postada geçer.
 */
export function NoAccessBox() {
  const { noAccess, refresh, signOut } = useSession();
  const [info, setInfo] = useState<string>();
  const [busy, setBusy] = useState(false);
  if (!noAccess) return null;

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setInfo(undefined);
    try {
      await fn();
      if (ok) setInfo(ok);
    } catch {
      setInfo(t('access.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="note" role="region" aria-label={t('login.noAccessTitle')}>
      <strong>{t('login.noAccessTitle')}</strong>
      <p>{t('access.intro')}</p>
      <p className="meta">{t('access.account', { email: noAccess.email || '-' })}</p>
      {!noAccess.emailVerified ? (
        <>
          <p>{t('access.unverified')}</p>
          <div className="actions">
            <button className="btn secondary" disabled={busy} onClick={() => run(() => authService.sendEmailVerification(), t('access.verificationSent'))}>
              {t('access.resendVerification')}
            </button>
            <button className="btn" disabled={busy} onClick={() => run(() => refresh())}>{t('access.verifiedRetry')}</button>
          </div>
        </>
      ) : (
        <button className="btn secondary" disabled={busy} onClick={() => run(() => refresh())}>{t('access.retry')}</button>
      )}
      {info ? <p role="status">{info}</p> : null}
      <button className="btn ghost" onClick={() => signOut()}>{t('login.logout')}</button>
    </div>
  );
}
