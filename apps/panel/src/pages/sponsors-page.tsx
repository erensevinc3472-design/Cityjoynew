import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { SPONSOR_NATIONWIDE, SPONSOR_PLACES, sponsorLive, validateSponsor, ymdOf, type Sponsor, type SponsorError, type SponsorInput, type SponsorPlace } from '@cityjoy/shared';
import { createSponsorAdmin } from '@cityjoy/shared/firebase';

import { ImageField } from '../components/image-field';
import { firestore } from '../lib/firebase';
import { locationRepository as repo } from '../lib/locations';
import { isAdminUser, useSession } from '../lib/session';
import { t } from '../lib/t';

/**
 * Panel > Sponsorlar (Eren, 11 Kasım 2026). Sosyal Harmoni ve Fırsatlar sayfalarının altındaki "Sponsorlu" bant.
 * Anlaşma uygulama dışında yapılır; sponsoru yalnızca admin ekler. Her işlem işlem kaydına yazılır.
 */
type Msg = { kind: 'ok' | 'error'; text: string } | undefined;
const fmt = (ymd: string) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString('tr-TR') : '');
const addDays = (n: number) => ymdOf(new Date(Date.now() + n * 86_400_000));
const empty = (): SponsorInput => ({ name: '', line: '', url: '', provinceCode: SPONSOR_NATIONWIDE, places: ['sosyal'], startsOn: addDays(0), endsOn: addDays(30), active: true });

export function SponsorsPage() {
  const { user } = useSession();
  const admin = isAdminUser(user);
  const canEdit = admin && !!user && !user.isDemo;
  const service = useMemo(() => (user ? createSponsorAdmin(firestore, user.uid) : null), [user]);
  const provinces = useMemo(() => repo.getProvinces(), []);
  const [list, setList] = useState<Sponsor[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<SponsorInput>(empty);
  const [errors, setErrors] = useState<SponsorError[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Msg>();

  const load = useCallback(async () => {
    setLoadError(false);
    if (!service) return;
    if (user?.isDemo) return setList([]);
    try {
      setList(await service.listAll());
    } catch {
      setLoadError(true);
    }
  }, [service, user?.isDemo]);
  useEffect(() => {
    load();
  }, [load]);

  if (!admin) return <section className="page"><p className="note">{t('sponsors.adminOnly')}</p></section>;

  const act = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setMessage(undefined);
    try {
      await fn();
      setMessage({ kind: 'ok', text: ok });
      await load();
    } catch {
      setMessage({ kind: 'error', text: t('sponsors.error') });
    } finally {
      setBusy(false);
    }
  };
  const reset = () => {
    setEditing(null);
    setDraft(empty());
    setErrors([]);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validateSponsor(draft);
    setErrors(errs);
    if (errs.length || !service) return;
    act(async () => {
      await service.save(editing, draft);
      reset();
    }, t('sponsors.saved'));
  };
  const edit = (s: Sponsor) => {
    setEditing(s.id);
    setDraft({ name: s.name, line: s.line, url: s.url ?? '', logo: s.logo, provinceCode: s.provinceCode, places: s.places, startsOn: s.startsOn, endsOn: s.endsOn, active: s.active });
    setErrors([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const togglePlace = (p: SponsorPlace) => setDraft({ ...draft, places: draft.places.includes(p) ? draft.places.filter((x) => x !== p) : [...draft.places, p] });
  const where = (code: string) => (code === SPONSOR_NATIONWIDE ? t('sponsors.nationwide') : (repo.getProvince(code)?.name ?? code));
  const state = (s: Sponsor) => {
    const today = ymdOf(new Date());
    if (!s.active) return { cls: 'pill', text: t('sponsors.state.off') };
    if (s.endsOn < today) return { cls: 'pill', text: t('sponsors.state.ended') };
    if (s.startsOn > today) return { cls: 'pill', text: t('sponsors.state.waiting') };
    return sponsorLive(s) ? { cls: 'pill ok', text: t('sponsors.state.live') } : { cls: 'pill', text: '' };
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('sponsors.title')}</h1>
          <p className="meta">{t('sponsors.intro')}</p>
        </div>
      </header>
      <p className="note">{t('sponsors.rules')}</p>
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}

      {canEdit && user ? (
        <form className="card" onSubmit={submit} aria-labelledby="sp-form-title">
          <h2 id="sp-form-title" className="card-title">{editing ? t('sponsors.editTitle') : t('sponsors.new')}</h2>
          <div className="field">
            <label htmlFor="sp-name">{t('sponsors.name')}</label>
            <input id="sp-name" value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="sp-line">{t('sponsors.line')}</label>
            <input id="sp-line" value={draft.line} maxLength={90} placeholder={t('sponsors.linePlaceholder')} onChange={(e) => setDraft({ ...draft, line: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="sp-url">{t('sponsors.url')}</label>
            <input id="sp-url" type="url" value={draft.url ?? ''} maxLength={300} placeholder="https://" onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
          </div>
          <ImageField label={t('sponsors.logo')} hint={t('sponsors.logoHint')} kind="kurum" uid={user.uid} value={draft.logo} onChange={(logo) => setDraft({ ...draft, logo })} disabled={busy} round />
          <div className="field">
            <label htmlFor="sp-prov">{t('sponsors.where')}</label>
            <select id="sp-prov" value={draft.provinceCode} onChange={(e) => setDraft({ ...draft, provinceCode: e.target.value })}>
              <option value={SPONSOR_NATIONWIDE}>{t('sponsors.nationwide')}</option>
              {provinces.map((p) => (
                <option key={p.code} value={p.code}>{p.name}</option>
              ))}
            </select>
          </div>
          <fieldset className="checkbox-group form-section">
            <legend>{t('sponsors.places')}</legend>
            {SPONSOR_PLACES.map((p) => (
              <label key={p}>
                <input type="checkbox" checked={draft.places.includes(p)} onChange={() => togglePlace(p)} />
                {t(`sponsors.place.${p}`)}
              </label>
            ))}
          </fieldset>
          <div className="field">
            <label htmlFor="sp-start">{t('sponsors.startsOn')}</label>
            <input id="sp-start" type="date" value={draft.startsOn} onChange={(e) => setDraft({ ...draft, startsOn: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="sp-end">{t('sponsors.endsOn')}</label>
            <input id="sp-end" type="date" value={draft.endsOn} onChange={(e) => setDraft({ ...draft, endsOn: e.target.value })} />
          </div>
          <label className="check">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> {t('sponsors.active')}
          </label>
          {errors.length ? <p className="error" role="alert">{errors.map((k) => t(`sponsors.errors.${k}`)).join(' ')}</p> : null}
          <div className="row-actions">
            <button className="btn" disabled={busy}>{editing ? t('sponsors.save') : t('sponsors.add')}</button>
            {editing ? <button type="button" className="btn secondary" disabled={busy} onClick={reset}>{t('sponsors.cancel')}</button> : null}
          </div>
        </form>
      ) : null}

      {loadError ? (
        <div className="state" role="alert">
          <p>{t('sponsors.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('sponsors.retry')}</button>
        </div>
      ) : list === null ? (
        <div className="state" aria-live="polite">{t('sponsors.loading')}</div>
      ) : !list.length ? (
        <div className="state">{t('sponsors.empty')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('sponsors.name')}</th>
                <th scope="col">{t('sponsors.where')}</th>
                <th scope="col">{t('sponsors.statusCol')}</th>
                <th scope="col"><span className="sr-only">{t('sponsors.actionsCol')}</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => {
                const st = state(s);
                return (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                      <div className="meta">{s.line}</div>
                      <div className="meta">{[s.places.map((p) => t(`sponsors.place.${p}`)).join(', '), `${fmt(s.startsOn)} – ${fmt(s.endsOn)}`].join(' · ')}</div>
                    </td>
                    <td>{where(s.provinceCode)}</td>
                    <td><span className={st.cls}>{st.text}</span></td>
                    <td className="row-actions">
                      {canEdit ? (
                        <>
                          <button className="link" disabled={busy} onClick={() => edit(s)}>{t('sponsors.edit')}</button>
                          <button className="link" disabled={busy} onClick={() => window.confirm(t('sponsors.confirmDelete', { name: s.name })) && act(() => service!.remove(s), t('sponsors.deleted'))}>{t('sponsors.delete')}</button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
