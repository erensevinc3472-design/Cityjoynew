import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { can, SOS_CONFIG_LIMITS, type SosConfig } from '@cityjoy/shared';
import { createSosSettingsAdmin } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { useSession } from '../lib/session';
import { t } from '../lib/t';

/**
 * SOS ayarları (PROJE.md 5.4). Uygulamadaki SOS'un panel karşılığı yalnızca ayarlardır: kişilerin SOS
 * kayıtları ve konumları panelde gösterilmez (gizlilik; veritabanı kuralları da admin okumasını engeller).
 */
export function SosSettingsPage() {
  const { user } = useSession();
  const canEdit = !!user && !user.isDemo && can(user.grants, { module: 'sos', action: 'duzenle' });
  const [config, setConfig] = useState<SosConfig | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      setConfig(await createSosSettingsAdmin(firestore, 'okuma').get());
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!config || !user) return;
    setBusy(true);
    setMessage(undefined);
    try {
      await createSosSettingsAdmin(firestore, user.uid).save(config);
      setMessage({ kind: 'ok', text: t('sosSettings.saved') });
      await load();
    } catch {
      setMessage({ kind: 'error', text: t('sosSettings.error') });
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof SosConfig) => (
    <div className="field">
      <label htmlFor={`sos-${key}`}>{t(`sosSettings.${key}`)}</label>
      <input
        id={`sos-${key}`}
        type="number"
        min={SOS_CONFIG_LIMITS[key][0]}
        max={SOS_CONFIG_LIMITS[key][1]}
        disabled={!canEdit}
        value={config![key]}
        onChange={(e) => setConfig({ ...config!, [key]: Number(e.target.value) })}
      />
      <span className="meta">{t('sosSettings.range', { min: SOS_CONFIG_LIMITS[key][0], max: SOS_CONFIG_LIMITS[key][1] })}</span>
    </div>
  );

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('sosSettings.title')}</h1>
          <p className="meta">{t('sosSettings.intro')}</p>
        </div>
      </header>
      <p className="note">{t('sosSettings.privacy')}</p>
      {user?.isDemo ? <p className="note">{t('sosSettings.demoReadOnly')}</p> : !canEdit ? <p className="note">{t('sosSettings.readOnly')}</p> : null}
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {loadError ? (
        <div className="state" role="alert">
          <p>{t('sosSettings.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('sosSettings.retry')}</button>
        </div>
      ) : config === null ? (
        <div className="state" aria-live="polite">{t('sosSettings.loading')}</div>
      ) : (
        <form className="form panel-form" onSubmit={submit}>
          {field('liveMinutes')}
          {field('countdownSeconds')}
          {canEdit ? (
            <div className="actions">
              <button className="btn" type="submit" disabled={busy}>{t('sosSettings.save')}</button>
            </div>
          ) : null}
        </form>
      )}
    </section>
  );
}
