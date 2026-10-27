import { useEffect, useState, type FormEvent } from 'react';
import type { AccessRequest } from '@cityjoy/shared';
import { getOwnAccessRequest, submitAccessRequest } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { useSession } from '../lib/session';
import { t } from '../lib/t';

/**
 * Yetkisi olmayan hesap: admin'e yetki talebi gönderir (PROJE.md 6). Admin talebi Yetkiler sayfasında görür;
 * yetkiyi yalnızca admin verir.
 */
export function AccessRequestBox() {
  const { noAccess, signOut } = useSession();
  const [existing, setExisting] = useState<AccessRequest | null | undefined>(undefined);
  const [note, setNote] = useState('');
  const [name, setName] = useState(noAccess?.displayName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!noAccess) return;
    getOwnAccessRequest(firestore, noAccess.uid).then(setExisting, () => setExisting(null));
  }, [noAccess]);

  if (!noAccess) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError(t('access.nameRequired'));
    if (note.trim().length < 5) return setError(t('access.noteRequired'));
    setBusy(true);
    setError(undefined);
    try {
      await submitAccessRequest(firestore, { ...noAccess, displayName: name }, note);
      setExisting(await getOwnAccessRequest(firestore, noAccess.uid));
    } catch {
      setError(t('access.error'));
    } finally {
      setBusy(false);
    }
  };

  const sentToday = existing && Date.now() - new Date(existing.createdAt).getTime() < 86400000;

  return (
    <div className="note" role="region" aria-label={t('login.noAccessTitle')}>
      <strong>{t('login.noAccessTitle')}</strong>
      <p>{t('access.intro')}</p>
      <p className="meta">{t('access.account', { email: noAccess.email || '-' })}</p>

      {existing === undefined ? (
        <p className="meta" aria-live="polite">{t('access.loading')}</p>
      ) : existing && (existing.status === 'yeni' || sentToday) ? (
        <p role="status">
          {t(`access.status.${existing.status}`, { date: new Date(existing.createdAt).toLocaleDateString('tr-TR') })}
        </p>
      ) : (
        <form className="form" onSubmit={submit} noValidate>
          {existing?.status === 'reddedildi' ? <p>{t('access.status.reddedildi')}</p> : null}
          <label htmlFor="access-name">{t('access.name')}</label>
          <input id="access-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          <label htmlFor="access-note">{t('access.note')}</label>
          <textarea id="access-note" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('access.notePlaceholder')} />
          {error ? <p className="error" role="alert">{error}</p> : null}
          <button className="btn" type="submit" disabled={busy}>{t('access.submit')}</button>
        </form>
      )}
      <button className="btn secondary" onClick={() => signOut()}>{t('login.logout')}</button>
    </div>
  );
}
