import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { LIMIT_GROUPS, LIMIT_RANGE, type Limits } from '@cityjoy/shared';
import { createLimitsAdmin } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { isAdminUser, useSession } from '../lib/session';
import { t } from '../lib/t';

/**
 * Günlük sınırlar (PROJE.md 15.3). Kişi, işletme, muhtar ve kurumun günde (duyuruda haftada da) kaç iş yapabileceği.
 * Yalnızca admin değiştirir, her değişiklik işlem kaydına yazılır; asıl denetim veritabanı kurallarında.
 */
export function LimitsPage() {
  const { user } = useSession();
  const canEdit = !!user && !user.isDemo && isAdminUser(user);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      setLimits(await createLimitsAdmin(firestore).get());
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!limits || !user) return;
    setBusy(true);
    setMessage(undefined);
    try {
      setLimits(await createLimitsAdmin(firestore).save(user.uid, limits));
      setMessage({ kind: 'ok', text: t('limits.saved') });
    } catch {
      setMessage({ kind: 'error', text: t('limits.error') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('limits.title')}</h1>
          <p className="meta">{t('limits.intro')}</p>
        </div>
      </header>
      <p className="note">{t('limits.never')}</p>
      {user?.isDemo ? <p className="note">{t('limits.demoReadOnly')}</p> : !canEdit ? <p className="note">{t('limits.adminOnly')}</p> : null}
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {loadError ? (
        <div className="state" role="alert">
          <p>{t('limits.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('limits.retry')}</button>
        </div>
      ) : limits === null ? (
        <div className="state" aria-live="polite">{t('limits.loading')}</div>
      ) : (
        <form className="form panel-form" onSubmit={submit}>
          {LIMIT_GROUPS.map((g) => (
            <fieldset key={g.id} className="form-section">
              <legend>{t(`limits.groups.${g.id}`)}</legend>
              {g.keys.map((k) => (
                <div key={k} className="field">
                  <label htmlFor={`limit-${k}`}>{t(`limits.keys.${k}`)}</label>
                  <input
                    id={`limit-${k}`}
                    type="number"
                    min={LIMIT_RANGE[0]}
                    max={LIMIT_RANGE[1]}
                    required
                    disabled={!canEdit}
                    value={limits[k]}
                    onChange={(e) => setLimits({ ...limits, [k]: Math.round(Number(e.target.value)) })}
                  />
                </div>
              ))}
            </fieldset>
          ))}
          <span className="meta">{t('limits.hint')}</span>
          {canEdit ? (
            <div className="actions">
              <button className="btn" type="submit" disabled={busy}>{t('limits.save')}</button>
            </div>
          ) : null}
        </form>
      )}
    </section>
  );
}
