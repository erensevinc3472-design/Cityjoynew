import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  can,
  DEFAULT_EMERGENCY_NUMBERS,
  EMERGENCY_ICONS,
  isValidPhoneNumber,
  LANGUAGES,
  normalizePhoneNumber,
  type EmergencyIcon,
  type EmergencyNumber,
  type LanguageCode,
} from '@cityjoy/shared';
import { createEmergencyNumberAdmin } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { useSession } from '../lib/session';
import { t } from '../lib/t';

type Texts = Partial<Record<LanguageCode, string>>;
type Draft = { id?: string; number: string; names: Texts; notes: Texts; icon: EmergencyIcon; order: number; active: boolean };

/** Acil numara yönetimi (admin, ülke geneli). Uygulamadaki Acil İhtiyaçlar ekranının panel karşılığı. */
export function EmergencyNumbersPage() {
  const { user } = useSession();
  const canEdit = !!user && !user.isDemo && can(user.grants, { module: 'acil-numaralar', action: 'duzenle' });
  const admin = user ? createEmergencyNumberAdmin(firestore, user.uid) : null;

  const [list, setList] = useState<EmergencyNumber[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      setList(user?.isDemo ? [] : await createEmergencyNumberAdmin(firestore, 'okuma').listAll());
    } catch {
      setLoadError(true);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const usingDefaults = list !== null && list.length === 0;
  const rows = usingDefaults ? DEFAULT_EMERGENCY_NUMBERS : (list ?? []);

  const act = async (fn: () => Promise<string>) => {
    setBusy(true);
    setMessage(undefined);
    try {
      setMessage({ kind: 'ok', text: await fn() });
      await load();
    } catch {
      setMessage({ kind: 'error', text: t('emergency.error') });
    } finally {
      setBusy(false);
    }
  };

  const submitDraft = (e: FormEvent) => {
    e.preventDefault();
    if (!draft || !admin) return;
    const number = normalizePhoneNumber(draft.number);
    const tr = draft.names.tr?.trim();
    if (!isValidPhoneNumber(number)) return setMessage({ kind: 'error', text: t('emergency.invalidNumber') });
    if (!tr) return setMessage({ kind: 'error', text: t('emergency.nameRequired') });
    const isNew = !draft.id;
    if (rows.some((n) => n.number === number && n.id !== draft.id)) return setMessage({ kind: 'error', text: t('emergency.duplicate') });
    const id = draft.id ?? number;
    const notesTr = draft.notes.tr?.trim();
    act(async () => {
      await admin.save(
        {
          id,
          number,
          names: { ...draft.names, tr },
          // Açıklamanın Türkçesi yoksa açıklama kaydedilmez (diğer diller Türkçeye geri döner).
          notes: notesTr ? { ...draft.notes, tr: notesTr } : undefined,
          icon: draft.icon,
          order: draft.order,
          active: draft.active,
        },
        isNew,
      );
      setDraft(null);
      return t('emergency.saved');
    });
  };

  const nextOrder = rows.reduce((m, n) => Math.max(m, n.order), 0) + 1;
  const textFields = (field: 'names' | 'notes') =>
    LANGUAGES.map((l) => (
      <div key={`${field}-${l.code}`} className="field">
        <label htmlFor={`em-${field}-${l.code}`}>{t(`emergency.lang.${l.code}`)}</label>
        <input
          id={`em-${field}-${l.code}`}
          dir={l.rtl ? 'rtl' : 'ltr'}
          maxLength={80}
          value={draft![field][l.code] ?? ''}
          onChange={(e) => setDraft({ ...draft!, [field]: { ...draft![field], [l.code]: e.target.value } })}
          required={field === 'names' && l.code === 'tr'}
        />
      </div>
    ));

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('emergency.title')}</h1>
          <p className="meta">{t('emergency.intro')}</p>
        </div>
        {canEdit && !usingDefaults ? (
          <div className="actions">
            <button className="btn" onClick={() => setDraft({ number: '', names: {}, notes: {}, icon: 'call', order: nextOrder, active: true })}>{t('emergency.add')}</button>
          </div>
        ) : null}
      </header>

      {user?.isDemo ? <p className="note">{t('emergency.demoReadOnly')}</p> : !canEdit ? <p className="note">{t('emergency.readOnly')}</p> : null}
      {usingDefaults ? (
        <div className="note">
          <p>{t('emergency.usingDefaults')}</p>
          {canEdit ? (
            <button className="btn" disabled={busy} onClick={() => act(async () => t('emergency.seeded', { count: await admin!.seedDefaults(new Set()) }))}>
              {t('emergency.seed')}
            </button>
          ) : null}
        </div>
      ) : null}
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}

      {draft ? (
        <form className="form panel-form" onSubmit={submitDraft}>
          <p className="form-section note" role="note">{t('emergency.verifyWarning')}</p>
          <div className="field">
            <label htmlFor="em-number">{t('emergency.number')}</label>
            <input id="em-number" inputMode="tel" dir="ltr" required value={draft.number} onChange={(e) => setDraft({ ...draft, number: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="em-icon">{t('emergency.icon')}</label>
            <select id="em-icon" value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value as EmergencyIcon })}>
              {EMERGENCY_ICONS.map((i) => (
                <option key={i} value={i}>{t(`emergency.icons.${i}`)}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="em-order">{t('emergency.order')}</label>
            <input id="em-order" type="number" min={1} value={draft.order} onChange={(e) => setDraft({ ...draft, order: Number(e.target.value) || 1 })} />
          </div>
          <h2 className="form-section">{t('emergency.names')}</h2>
          {textFields('names')}
          <h2 className="form-section">{t('emergency.notes')}</h2>
          {textFields('notes')}
          <div className="actions">
            <button className="btn" type="submit" disabled={busy}>{t('emergency.save')}</button>
            <button className="btn ghost" type="button" onClick={() => {
              setDraft(null);
              setMessage(undefined);
            }}>{t('emergency.cancel')}</button>
          </div>
        </form>
      ) : null}

      {loadError ? (
        <div className="state" role="alert">
          <p>{t('emergency.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('emergency.retry')}</button>
        </div>
      ) : list === null ? (
        <div className="state" aria-live="polite">{t('emergency.loading')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('emergency.order')}</th>
                <th scope="col">{t('emergency.number')}</th>
                <th scope="col">{t('emergency.name')}</th>
                <th scope="col">{t('emergency.status')}</th>
                {canEdit && !usingDefaults ? <th scope="col"><span className="sr-only">{t('emergency.edit')}</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => {
                const missing = LANGUAGES.filter((l) => !n.names[l.code]).length;
                return (
                  <tr key={n.id}>
                    <td className="num">{n.order}</td>
                    <td className="num" dir="ltr"><strong>{n.number}</strong></td>
                    <td>
                      {n.names.tr}
                      {n.notes?.tr ? <span className="meta"> · {n.notes.tr}</span> : null}
                      <div className="meta">
                        {t(`emergency.icons.${n.icon}`)} · {missing ? t('emergency.missingTranslations', { count: missing }) : t('emergency.allTranslations')}
                      </div>
                    </td>
                    <td><span className={n.active ? 'pill ok' : 'pill'}>{n.active ? t('emergency.active') : t('emergency.inactive')}</span></td>
                    {canEdit && !usingDefaults ? (
                      <td>
                        <div className="row-actions">
                          <button className="link" onClick={() => setDraft({ id: n.id, number: n.number, names: { ...n.names }, notes: { ...n.notes }, icon: n.icon, order: n.order, active: n.active })}>
                            {t('emergency.edit')}
                          </button>
                          <button className="link" disabled={busy} onClick={() => act(async () => {
                            await admin!.setActive(n, !n.active);
                            return t('emergency.saved');
                          })}>
                            {n.active ? t('emergency.deactivate') : t('emergency.activate')}
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="count">{t('emergency.noDelete')}</p>
        </div>
      )}
    </section>
  );
}
