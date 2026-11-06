import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { BILLING_CAP_RANGE, BILLING_PROJECTS_URL, capFor, validCap, type BillingStatus } from '@cityjoy/shared';
import { createBillingAdmin } from '@cityjoy/shared/firebase';

import { firestore, functions } from '../lib/firebase';
import { isAdminUser, useSession } from '../lib/session';
import { t } from '../lib/t';

const tl = (n: number) => `${n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} TL`;
const when = (s?: string) => (s ? new Date(s).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }) : '');

/**
 * Harcama sigortası (Eren istedi, 7 Kasım 2026). Bu ayki Google Cloud harcaması, sigorta tutarı (ulaşınca ödeme
 * bağlantısı kendiliğinden kopar) ve "Şimdi durdur". Yeniden açma Google Cloud'dan yapılır: bağlantı kopukken sunucu
 * çalışmaz, yalnızca ödeme hesabının sahibi yeniden bağlayabilir.
 */
export function BillingPage() {
  const { user } = useSession();
  const canEdit = !!user && !user.isDemo && isAdminUser(user);
  const admin = createBillingAdmin(firestore, functions);
  const [status, setStatus] = useState<BillingStatus | null | undefined>(undefined);
  const [cap, setCap] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const a = createBillingAdmin(firestore, functions);
      const [s, c] = await Promise.all([a.status(), a.cap()]);
      setStatus(s);
      setCap(c ? String(c) : '');
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    if (canEdit) load();
  }, [load, canEdit]);

  const run = async (fn: () => Promise<unknown>, ok: string, error: string) => {
    setBusy(true);
    setMessage(undefined);
    try {
      await fn();
      setMessage({ kind: 'ok', text: ok });
      await load();
    } catch {
      setMessage({ kind: 'error', text: error });
    } finally {
      setBusy(false);
    }
  };

  const saveCap = (e: FormEvent) => {
    e.preventDefault();
    const v = Number(cap);
    if (!user || !validCap(v)) {
      setMessage({ kind: 'error', text: t('billing.capInvalid', { min: BILLING_CAP_RANGE[0], max: BILLING_CAP_RANGE[1] }) });
      return;
    }
    run(() => admin.saveCap(user.uid, v), t('billing.capSaved'), t('billing.error'));
  };

  const stop = () => {
    if (!window.confirm(t('billing.stopConfirm'))) return;
    run(() => admin.stopNow(), t('billing.stopped'), t('billing.stopError'));
  };

  const savedCap = Number(cap) || null;
  const effectiveCap = status ? capFor(status.budgetAmount, savedCap) : null;

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('billing.title')}</h1>
          <p className="meta">{t('billing.intro')}</p>
        </div>
      </header>
      {!canEdit ? (
        <p className="note">{t('billing.adminOnly')}</p>
      ) : (
        <>
          {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
          {loadError ? (
            <div className="state" role="alert">
              <p>{t('billing.loadError')}</p>
              <button className="btn secondary" onClick={load}>{t('billing.retry')}</button>
            </div>
          ) : status === undefined ? (
            <div className="state" aria-live="polite">{t('billing.loading')}</div>
          ) : (
            <>
              {status === null ? (
                <p className="note">{t('billing.noData')}</p>
              ) : (
                <div className="stat-grid">
                  <div className={`card stat${status.enabled ? '' : ' highlight'}`}>
                    <span className="stat-label">{t('billing.state')}</span>
                    <strong className="stat-value">{status.enabled ? t('billing.on') : t(status.stoppedBy === 'panel' ? 'billing.offPanel' : 'billing.offCap')}</strong>
                    {!status.enabled && status.stoppedAt ? <span className="meta">{when(status.stoppedAt)}</span> : null}
                  </div>
                  <div className="card stat">
                    <span className="stat-label">{t('billing.cost')}</span>
                    <strong className="stat-value">{tl(status.costAmount)}</strong>
                    {status.updatedAt ? <span className="meta">{t('billing.updated', { at: when(status.updatedAt) })}</span> : null}
                  </div>
                  <div className="card stat">
                    <span className="stat-label">{t('billing.budget')}</span>
                    <strong className="stat-value">{tl(status.budgetAmount)}</strong>
                  </div>
                  <div className="card stat">
                    <span className="stat-label">{t('billing.cap')}</span>
                    <strong className="stat-value">{effectiveCap ? tl(effectiveCap) : '-'}</strong>
                  </div>
                </div>
              )}

              <form className="form panel-form" onSubmit={saveCap}>
                <fieldset className="form-section">
                  <legend>{t('billing.capTitle')}</legend>
                  <div className="field">
                    <label htmlFor="billing-cap">{t('billing.capLabel')}</label>
                    <input
                      id="billing-cap"
                      type="number"
                      inputMode="numeric"
                      min={BILLING_CAP_RANGE[0]}
                      max={BILLING_CAP_RANGE[1]}
                      placeholder={t('billing.capPlaceholder')}
                      value={cap}
                      onChange={(e) => setCap(e.target.value)}
                    />
                  </div>
                  <span className="meta">{t('billing.capHint')}</span>
                </fieldset>
                <div className="actions">
                  <button className="btn" type="submit" disabled={busy}>{t('billing.save')}</button>
                </div>
              </form>

              <fieldset className="form-section">
                <legend>{t('billing.stopTitle')}</legend>
                <p className="meta">{t('billing.stopHint')}</p>
                <div className="actions">
                  <button className="btn" type="button" disabled={busy || status?.enabled === false} onClick={stop}>{t('billing.stop')}</button>
                </div>
              </fieldset>

              <fieldset className="form-section">
                <legend>{t('billing.reopenTitle')}</legend>
                <p className="meta">{t('billing.reopenHint')}</p>
                <div className="actions">
                  <a className="btn secondary" href={BILLING_PROJECTS_URL} target="_blank" rel="noreferrer">{t('billing.reopen')}</a>
                </div>
              </fieldset>
            </>
          )}
        </>
      )}
    </section>
  );
}
