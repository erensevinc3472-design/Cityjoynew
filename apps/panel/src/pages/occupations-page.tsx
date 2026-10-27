import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { can, DEFAULT_OCCUPATIONS, LANGUAGES, type LanguageCode, type Occupation } from '@cityjoy/shared';
import { createOccupationAdmin, occupationIdFromName } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { useSession } from '../lib/session';
import { t } from '../lib/t';

const NAME_LABEL: Record<LanguageCode, string> = {
  tr: 'occupations.nameTr',
  en: 'occupations.nameEn',
  de: 'occupations.nameDe',
  ar: 'occupations.nameAr',
  ru: 'occupations.nameRu',
};

type Draft = { id?: string; names: Partial<Record<LanguageCode, string>>; order: number; active: boolean };

/** Meslek listesi yönetimi (admin). Uygulamadaki kayıt ekranının panel karşılığı. */
export function OccupationsPage() {
  const { user } = useSession();
  const canEdit = !!user && !user.isDemo && can(user.grants, { module: 'meslekler', action: 'duzenle' });
  const admin = user ? createOccupationAdmin(firestore, user.uid) : null;

  const [list, setList] = useState<Occupation[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      setList(user?.isDemo ? [] : await createOccupationAdmin(firestore, 'okuma').listAll());
    } catch {
      setLoadError(true);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const usingDefaults = list !== null && list.length === 0;
  const rows = usingDefaults ? DEFAULT_OCCUPATIONS : (list ?? []);

  const act = async (fn: () => Promise<string>) => {
    setBusy(true);
    setMessage(undefined);
    try {
      setMessage({ kind: 'ok', text: await fn() });
      await load();
    } catch {
      setMessage({ kind: 'error', text: t('occupations.error') });
    } finally {
      setBusy(false);
    }
  };

  const submitDraft = (e: FormEvent) => {
    e.preventDefault();
    if (!draft || !admin) return;
    const tr = draft.names.tr?.trim();
    if (!tr) return setMessage({ kind: 'error', text: t('occupations.nameRequired') });
    const isNew = !draft.id;
    const id = draft.id ?? occupationIdFromName(tr);
    if (isNew && rows.some((o) => o.id === id)) return setMessage({ kind: 'error', text: t('occupations.duplicate') });
    act(async () => {
      await admin.save({ id, names: { ...draft.names, tr }, order: draft.order, active: draft.active }, isNew);
      setDraft(null);
      return t('occupations.saved');
    });
  };

  const nextOrder = rows.reduce((m, o) => Math.max(m, o.order), 0) + 1;

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('occupations.title')}</h1>
          <p className="meta">{t('occupations.intro')}</p>
        </div>
        {canEdit && !usingDefaults ? (
          <div className="actions">
            <button className="btn" onClick={() => setDraft({ names: {}, order: nextOrder, active: true })}>{t('occupations.add')}</button>
          </div>
        ) : null}
      </header>

      {user?.isDemo ? <p className="note">{t('occupations.demoReadOnly')}</p> : null}
      {usingDefaults ? (
        <div className="note">
          <p>{t('occupations.usingDefaults')}</p>
          {canEdit ? (
            <button className="btn" disabled={busy} onClick={() => act(async () => t('occupations.seeded', { count: await admin!.seedDefaults(new Set()) }))}>
              {t('occupations.seed')}
            </button>
          ) : null}
        </div>
      ) : null}
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}

      {draft ? (
        <form className="form panel-form" onSubmit={submitDraft}>
          {LANGUAGES.map((l) => (
            <div key={l.code} className="field">
              <label htmlFor={`occ-${l.code}`}>{t(NAME_LABEL[l.code])}</label>
              <input
                id={`occ-${l.code}`}
                dir={l.rtl ? 'rtl' : 'ltr'}
                value={draft.names[l.code] ?? ''}
                onChange={(e) => setDraft({ ...draft, names: { ...draft.names, [l.code]: e.target.value } })}
                required={l.code === 'tr'}
              />
            </div>
          ))}
          <div className="field">
            <label htmlFor="occ-order">{t('occupations.order')}</label>
            <input id="occ-order" type="number" min={1} value={draft.order} onChange={(e) => setDraft({ ...draft, order: Number(e.target.value) || 1 })} />
          </div>
          <div className="actions">
            <button className="btn" type="submit" disabled={busy}>{t('occupations.save')}</button>
            <button className="btn ghost" type="button" onClick={() => {
              setDraft(null);
              setMessage(undefined);
            }}>{t('occupations.cancel')}</button>
          </div>
        </form>
      ) : null}

      {loadError ? (
        <div className="state" role="alert">
          <p>{t('occupations.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('occupations.retry')}</button>
        </div>
      ) : list === null ? (
        <div className="state" aria-live="polite">{t('occupations.loading')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('occupations.order')}</th>
                <th scope="col">{t('occupations.name')}</th>
                <th scope="col">{t('occupations.status')}</th>
                {canEdit && !usingDefaults ? <th scope="col"><span className="sr-only">{t('occupations.edit')}</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const missing = LANGUAGES.filter((l) => !o.names[l.code]).length;
                return (
                  <tr key={o.id}>
                    <td className="num">{o.order}</td>
                    <td>
                      {o.names.tr}
                      <div className="meta">{missing ? t('occupations.missingTranslations', { count: missing }) : t('occupations.allTranslations')}</div>
                    </td>
                    <td><span className={o.active ? 'pill ok' : 'pill'}>{o.active ? t('occupations.active') : t('occupations.inactive')}</span></td>
                    {canEdit && !usingDefaults ? (
                      <td>
                        <div className="row-actions">
                        <button className="link" onClick={() => setDraft({ id: o.id, names: { ...o.names }, order: o.order, active: o.active })}>{t('occupations.edit')}</button>
                        <button className="link" disabled={busy} onClick={() => act(async () => {
                          await admin!.setActive(o, !o.active);
                          return t('occupations.saved');
                        })}>
                          {o.active ? t('occupations.deactivate') : t('occupations.activate')}
                        </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="count">{t('occupations.noDelete')}</p>
        </div>
      )}
    </section>
  );
}
