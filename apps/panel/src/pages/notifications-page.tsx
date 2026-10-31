import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  CRITICAL_CATEGORIES,
  DAILY_SOUND_CAP_RANGE,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_PRIORITIES,
  PRIORITY_KEYS,
  type NotificationPriority,
  type NotificationSettings,
} from '@cityjoy/shared';
import { createNotificationTriggers } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { isAdminUser, useSession } from '../lib/session';
import { t } from '../lib/t';

/**
 * Bildirimler (PROJE.md 5.12, 7). Şimdilik tetikleyiciler: hangi olayların kullanıcının bildirim merkezine düştüğü
 * (yalnızca admin değiştirir; acil duyuru ve SOS kapatılamaz) ve telefona giden bildirimin önceliği: her zaman çalar,
 * normal (kişi başına günlük sesli tavana kadar sesli, sonra sessiz) ya da yalnızca uygulama içi. Gruba bildirim
 * gönderme (kampanya, hedef seçimi, onay) sonra gelecek.
 */
export function NotificationsPage() {
  const { user } = useSession();
  const canEdit = !!user && !user.isDemo && isAdminUser(user);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      setSettings(await createNotificationTriggers(firestore).getSettings());
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings || !user) return;
    setBusy(true);
    setMessage(undefined);
    try {
      setSettings(await createNotificationTriggers(firestore).saveSettings(user.uid, settings));
      setMessage({ kind: 'ok', text: t('notifications.saved') });
    } catch {
      setMessage({ kind: 'error', text: t('notifications.error') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('notifications.title')}</h1>
          <p className="meta">{t('notifications.intro')}</p>
        </div>
      </header>
      <p className="note">{t('notifications.sendingSoon')}</p>
      {user?.isDemo ? <p className="note">{t('notifications.demoReadOnly')}</p> : !canEdit ? <p className="note">{t('notifications.adminOnly')}</p> : null}
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {loadError ? (
        <div className="state" role="alert">
          <p>{t('notifications.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('notifications.retry')}</button>
        </div>
      ) : settings === null ? (
        <div className="state" aria-live="polite">{t('notifications.loading')}</div>
      ) : (
        <form className="form panel-form" onSubmit={submit}>
          <fieldset className="checkbox-group form-section">
            <legend>{t('notifications.triggers')}</legend>
            {NOTIFICATION_CATEGORIES.map((cat) => {
              const critical = CRITICAL_CATEGORIES.includes(cat);
              return (
                <label key={cat}>
                  <input
                    type="checkbox"
                    checked={settings.triggers[cat]}
                    disabled={!canEdit || critical}
                    onChange={(e) => setSettings({ ...settings, triggers: { ...settings.triggers, [cat]: e.target.checked } })}
                  />
                  <span>
                    {t(`notifications.categories.${cat}`)}
                    {critical ? <small className="meta"> · {t('notifications.alwaysOn')}</small> : null}
                  </span>
                </label>
              );
            })}
          </fieldset>
          <span className="meta">{t('notifications.hint')}</span>
          <fieldset className="form-section">
            <legend>{t('notifications.priorityTitle')}</legend>
            <p className="meta">{t('notifications.priorityIntro')}</p>
            <div className="field">
              <span>{t('notifications.priorityKeys.acil')}</span>
              <span className="meta">{t('notifications.priorities.always')} · {t('notifications.alwaysOn')}</span>
            </div>
            {PRIORITY_KEYS.map((k) => (
              <div key={k} className="field">
                <label htmlFor={`prio-${k}`}>{t(`notifications.priorityKeys.${k}`)}</label>
                <select
                  id={`prio-${k}`}
                  value={settings.priorities[k]}
                  disabled={!canEdit}
                  onChange={(e) => setSettings({ ...settings, priorities: { ...settings.priorities, [k]: e.target.value as NotificationPriority } })}
                >
                  {NOTIFICATION_PRIORITIES.map((p) => (
                    <option key={p} value={p}>{t(`notifications.priorities.${p}`)}</option>
                  ))}
                </select>
              </div>
            ))}
            <div className="field">
              <label htmlFor="sound-cap">{t('notifications.soundCap')}</label>
              <input
                id="sound-cap"
                type="number"
                min={DAILY_SOUND_CAP_RANGE[0]}
                max={DAILY_SOUND_CAP_RANGE[1]}
                required
                disabled={!canEdit}
                value={settings.dailySoundCap}
                onChange={(e) => setSettings({ ...settings, dailySoundCap: Math.round(Number(e.target.value)) })}
              />
              <span className="meta">{t('notifications.soundCapHint', { min: DAILY_SOUND_CAP_RANGE[0], max: DAILY_SOUND_CAP_RANGE[1] })}</span>
            </div>
            <p className="note">{t('notifications.blazeNote')}</p>
          </fieldset>
          {canEdit ? (
            <div className="actions">
              <button className="btn" type="submit" disabled={busy}>{t('notifications.save')}</button>
            </div>
          ) : null}
        </form>
      )}
    </section>
  );
}
