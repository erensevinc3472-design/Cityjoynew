import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CRITICAL_CATEGORIES, NOTIFICATION_CATEGORIES, type NotificationTriggers } from '@cityjoy/shared';
import { createNotificationTriggers } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { isAdminUser, useSession } from '../lib/session';
import { t } from '../lib/t';

/**
 * Bildirimler (PROJE.md 5.12, 7). Şimdilik tetikleyiciler: hangi olayların kullanıcının bildirim merkezine düştüğü
 * (yalnızca admin değiştirir; acil duyuru ve SOS kapatılamaz). Gruba bildirim gönderme (kampanya, hedef seçimi, onay)
 * telefona bildirim altyapısıyla gelecek.
 */
export function NotificationsPage() {
  const { user } = useSession();
  const canEdit = !!user && !user.isDemo && isAdminUser(user);
  const [triggers, setTriggers] = useState<NotificationTriggers | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      setTriggers(await createNotificationTriggers(firestore).get());
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!triggers || !user) return;
    setBusy(true);
    setMessage(undefined);
    try {
      setTriggers(await createNotificationTriggers(firestore).save(user.uid, triggers));
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
      ) : triggers === null ? (
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
                    checked={triggers[cat]}
                    disabled={!canEdit || critical}
                    onChange={(e) => setTriggers({ ...triggers, [cat]: e.target.checked })}
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
