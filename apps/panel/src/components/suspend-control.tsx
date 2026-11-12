import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { SUSPENSION_DAYS, SUSPENSION_NOTE_MAX, SUSPENSION_REASONS, type Suspension, type SuspensionDays, type SuspensionReason } from '@cityjoy/shared';
import { createSuspensionAdmin } from '@cityjoy/shared/firebase';

import { firestore, functions } from '../lib/firebase';
import { t } from '../lib/t';

export const suspensionAdmin = () => createSuspensionAdmin(firestore, functions);

const daysKey = (d: SuspensionDays) => (d === null ? 'forever' : `d${d}`);

export interface SuspendChoice {
  reason: SuspensionReason;
  days: SuspensionDays;
  note?: string;
  banOwner: boolean;
}

/** Bir hesabı askıya alma / askıyı kaldırma düğmesi (yalnızca admin; yetkiyi sunucu da denetler). */
export function SuspendControl({ uid, name, suspended, onDone }: { uid: string; name: string; suspended: boolean; onDone: (ok: boolean) => void }) {
  return (
    <SuspendForm
      name={name}
      suspended={suspended}
      onDone={onDone}
      suspend={(c) => suspensionAdmin().suspend({ uid, reason: c.reason, days: c.days, ...(c.note ? { note: c.note } : {}) })}
      lift={() => suspensionAdmin().lift(uid)}
    />
  );
}

/**
 * Askıya al / Askıyı kaldır: sebep, süre ve kısa not sorulur (işletmede ayrıca "sahibi yeni işletme açamasın").
 * Askıyı kaldır onay sorar.
 */
export function SuspendForm({
  name,
  suspended,
  onDone,
  suspend,
  lift,
  business,
}: {
  name: string;
  suspended: boolean;
  onDone: (ok: boolean) => void;
  suspend: (c: SuspendChoice) => Promise<void>;
  lift: () => Promise<void>;
  /** İşletme askısı: metinler işletmeye göre, "sahibi yeni işletme açamasın" kutusu görünür. */
  business?: boolean;
}) {
  const [banOwner, setBanOwner] = useState(true);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<SuspensionReason>('uygunsuz-icerik');
  const [days, setDays] = useState<SuspensionDays>(7);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      setOpen(false);
      setNote('');
      onDone(true);
    } catch {
      onDone(false);
    } finally {
      setBusy(false);
    }
  };

  if (suspended) {
    return (
      <button className="link" disabled={busy} onClick={() => window.confirm(t(business ? 'suspend.liftBusinessConfirm' : 'suspend.liftConfirm', { name })) && run(lift)}>
        {t('suspend.lift')}
      </button>
    );
  }
  if (!open) {
    return <button className="link danger" onClick={() => setOpen(true)}>{t('suspend.open')}</button>;
  }
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => suspend({ reason, days, banOwner: !!business && banOwner, ...(note.trim() ? { note: note.trim() } : {}) }));
  };
  return (
    <form className="suspend-form" onSubmit={submit} aria-label={t('suspend.formLabel', { name })}>
      <label htmlFor={`${id}-r`}>{t('suspend.reason')}</label>
      <select id={`${id}-r`} value={reason} onChange={(e) => setReason(e.target.value as SuspensionReason)}>
        {SUSPENSION_REASONS.map((r) => <option key={r} value={r}>{t(`suspend.reasons.${r}`)}</option>)}
      </select>
      <label htmlFor={`${id}-d`}>{t('suspend.duration')}</label>
      <select id={`${id}-d`} value={daysKey(days)} onChange={(e) => setDays(SUSPENSION_DAYS.find((d) => daysKey(d) === e.target.value) ?? 7)}>
        {SUSPENSION_DAYS.map((d) => <option key={daysKey(d)} value={daysKey(d)}>{t(`suspend.days.${daysKey(d)}`)}</option>)}
      </select>
      <label htmlFor={`${id}-n`}>{t('suspend.note')}</label>
      <input id={`${id}-n`} value={note} maxLength={SUSPENSION_NOTE_MAX} onChange={(e) => setNote(e.target.value)} placeholder={t('suspend.notePlaceholder')} />
      {business ? (
        <label className="check">
          <input type="checkbox" checked={banOwner} onChange={(e) => setBanOwner(e.target.checked)} /> {t('suspend.banOwner')}
        </label>
      ) : null}
      <p className="meta">{t(business ? 'suspend.businessEffect' : 'suspend.effect')}</p>
      <div className="row-actions">
        <button className="btn danger" type="submit" disabled={busy}>{t('suspend.confirm')}</button>
        <button className="btn secondary" type="button" disabled={busy} onClick={() => setOpen(false)}>{t('suspend.cancel')}</button>
      </div>
    </form>
  );
}

/** Profiller sayfası: şu an askıda olan hesaplar, sebep ve bitiş tarihiyle. */
export function SuspendedList({ refreshKey, onDone }: { refreshKey: number; onDone: (ok: boolean) => void }) {
  const admin = useMemo(suspensionAdmin, []);
  const [list, setList] = useState<Suspension[] | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    setError(false);
    try {
      setList(await admin.listActive());
    } catch {
      setError(true);
      setList([]);
    }
  }, [admin]);
  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <section aria-labelledby="suspended-title">
      <h2 id="suspended-title">{t('suspend.listTitle')}</h2>
      {error ? (
        <p className="error">{t('suspend.listError')}</p>
      ) : list === null ? (
        <p className="state" aria-live="polite">{t('moderation.loading')}</p>
      ) : list.length === 0 ? (
        <p className="state">{t('suspend.listEmpty')}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('profiles.colName')}</th>
                <th scope="col">{t('suspend.reason')}</th>
                <th scope="col">{t('suspend.since')}</th>
                <th scope="col">{t('suspend.until')}</th>
                <th scope="col"><span className="sr-only">{t('moderation.actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.uid}>
                  <td>{s.displayName || s.uid}</td>
                  <td>
                    {t(`suspend.reasons.${s.reason}`)}
                    {s.note ? <p className="meta" dir="auto" style={{ margin: 0 }}>{s.note}</p> : null}
                  </td>
                  <td className="num">{new Date(s.at).toLocaleDateString('tr-TR')}</td>
                  <td className="num">{s.until ? new Date(s.until).toLocaleDateString('tr-TR') : t('suspend.days.forever')}</td>
                  <td>
                    <SuspendControl uid={s.uid} name={s.displayName || s.uid} suspended onDone={(ok) => { onDone(ok); if (ok) load(); }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
