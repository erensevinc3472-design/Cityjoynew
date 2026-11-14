import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router';
import { BADGE_ICONS, BADGE_LIMITS, badgeIdFromName, type BadgeDefinition, type BadgeIcon, type LanguageCode, type PublicProfile } from '@cityjoy/shared';
import { createBadgeAdmin } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { isAdminUser, useSession } from '../lib/session';
import { t } from '../lib/t';
import { Intro } from '../components/intro';
import { BadgeControl, BadgePills, OfficialControl } from '../components/badge-control';

const OTHER_LANGS: Exclude<LanguageCode, 'tr'>[] = ['en', 'de', 'ar', 'ru'];

/**
 * Rozetler (yalnızca admin; Eren, 13 Kasım 2026). Rozet listesi (ad, 5 dilde ad, simge, yayıncı mı) ve rozeti olan
 * kişiler. Rozet verme Profiller'de kişiyi bulup "Rozet ver" ile yapılır; kullanıcı rozet istemez.
 */
export function BadgesPage() {
  const { user } = useSession();
  const admin = useMemo(() => (user ? createBadgeAdmin(firestore, user.uid) : null), [user]);
  const [defs, setDefs] = useState<BadgeDefinition[] | null>(null);
  const [saved, setSaved] = useState(true);
  const [holders, setHolders] = useState<PublicProfile[] | null>(null);
  const [officials, setOfficials] = useState<PublicProfile[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!admin) return;
    setLoadError(false);
    try {
      const r = await admin.load();
      setDefs(r.items);
      setSaved(r.saved);
      if (!user?.isDemo) {
        setHolders(await admin.holders(r.items.map((b) => b.id)).catch(() => []));
        setOfficials(await admin.officials().catch(() => []));
      }
    } catch {
      setLoadError(true);
    }
  }, [admin, user?.isDemo]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user || !isAdminUser(user)) return <Navigate to="/" replace />;
  const canEdit = !user.isDemo;

  const save = async (next: BadgeDefinition[]) => {
    if (!admin) return;
    setBusy(true);
    setMessage(undefined);
    try {
      setDefs(await admin.save(next));
      setSaved(true);
      setEditing(null);
      setMessage({ kind: 'ok', text: t('badges.saved') });
    } catch {
      setMessage({ kind: 'error', text: t('badges.saveError') });
    } finally {
      setBusy(false);
    }
  };

  const remove = (i: number) => {
    if (!defs) return;
    const b = defs[i]!;
    if (window.confirm(t('badges.removeConfirm', { name: b.name.tr }))) save(defs.filter((_, j) => j !== i));
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('badges.title')}</h1>
          <Intro text={t('badges.intro')} />
        </div>
        {canEdit && defs && editing === null && defs.length < BADGE_LIMITS.definitions ? (
          <button className="btn" onClick={() => setEditing(-1)}>{t('badges.new')}</button>
        ) : null}
      </header>

      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {loadError ? <p className="error" role="alert">{t('badges.loadError')}</p> : null}
      {!saved && defs ? <p className="note">{t('badges.defaultsNote')}</p> : null}

      {editing === -1 && defs ? (
        <BadgeForm
          busy={busy}
          taken={defs.map((d) => d.id)}
          onCancel={() => setEditing(null)}
          onSave={(b) => save([...defs, b])}
        />
      ) : null}

      {defs === null && !loadError ? <p className="state" aria-live="polite">{t('badges.loading')}</p> : null}
      {defs && defs.length === 0 ? <p className="state">{t('badges.empty')}</p> : null}
      {defs && defs.length ? (
        <ul className="badge-list">
          {defs.map((b, i) =>
            editing === i ? (
              <li key={b.id}>
                <BadgeForm busy={busy} initial={b} taken={defs.filter((_, j) => j !== i).map((d) => d.id)} onCancel={() => setEditing(null)} onSave={(nb) => save(defs.map((d, j) => (j === i ? nb : d)))} />
              </li>
            ) : (
              <li key={b.id} className="card badge-row">
                <span className="badge-icon" aria-hidden="true">★</span>
                <div className="grow">
                  <strong>{b.name.tr}</strong>
                  {b.publisher ? <span className="pill ok">{t('badges.publisherShort')}</span> : null}
                  <p className="meta">
                    {OTHER_LANGS.map((l) => b.name[l]).filter(Boolean).join(' · ') || t('badges.onlyTurkish')} · {t('badges.iconLabel')}: {t(`badges.icons.${b.icon}`)}
                  </p>
                </div>
                {canEdit && editing === null ? (
                  <div className="row-actions">
                    <button className="link" onClick={() => setEditing(i)}>{t('badges.edit')}</button>
                    <button className="link danger" disabled={busy} onClick={() => remove(i)}>{t('badges.remove')}</button>
                  </div>
                ) : null}
              </li>
            ),
          )}
        </ul>
      ) : null}

      {!user.isDemo ? (
        <section aria-labelledby="officials-title">
          <h2 id="officials-title">{t('badges.official.title')}</h2>
          <p className="meta">
            {t('badges.official.how')} <Link to="/profiller">{t('menu.items.profiller')}</Link>
          </p>
          {officials === null ? (
            <p className="state" aria-live="polite">{t('badges.loading')}</p>
          ) : officials.length === 0 ? (
            <p className="state">{t('badges.official.none')}</p>
          ) : (
            <ul className="badge-list">
              {officials.map((p) => (
                <li key={p.uid} className="card badge-row">
                  <span className="badge-icon official-seal" aria-hidden="true">✓</span>
                  <div className="grow">
                    <strong>{p.displayName}</strong>
                    <p className="meta">{t('badges.official.pill')}</p>
                  </div>
                  <div className="row-actions">
                    <OfficialControl
                      actorUid={user.uid}
                      profile={p}
                      onDone={(ok) => {
                        setMessage(ok ? { kind: 'ok', text: t('badges.official.undone', { name: p.displayName }) } : { kind: 'error', text: t('badges.saveError') });
                        if (ok) setOfficials((os) => (os ?? []).filter((o) => o.uid !== p.uid));
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {defs && !user.isDemo ? (
        <section aria-labelledby="holders-title">
          <h2 id="holders-title">{t('badges.holdersTitle')}</h2>
          <p className="meta">
            {t('badges.howToGive')} <Link to="/profiller">{t('menu.items.profiller')}</Link>
          </p>
          {holders === null ? (
            <p className="state" aria-live="polite">{t('badges.loading')}</p>
          ) : holders.length === 0 ? (
            <p className="state">{t('badges.noHolders')}</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t('profiles.colName')}</th>
                    <th scope="col">{t('badges.colBadges')}</th>
                    <th scope="col"><span className="sr-only">{t('moderation.actions')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {holders.map((p) => (
                    <tr key={p.uid}>
                      <td>{p.displayName}</td>
                      <td><BadgePills ids={p.badges} defs={defs} /></td>
                      <td>
                        <BadgeControl
                          actorUid={user.uid}
                          profile={p}
                          defs={defs}
                          onDone={(ok, badges) => {
                            setMessage(ok ? { kind: 'ok', text: t('badges.given') } : { kind: 'error', text: t('badges.saveError') });
                            if (ok) setHolders((hs) => (hs ?? []).map((h) => (h.uid === p.uid ? { ...h, badges: badges ?? [] } : h)).filter((h) => h.badges?.length));
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </section>
  );
}

function BadgeForm({
  initial,
  taken,
  busy,
  onSave,
  onCancel,
}: {
  initial?: BadgeDefinition;
  taken: string[];
  busy: boolean;
  onSave: (b: BadgeDefinition) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [name, setName] = useState<BadgeDefinition['name']>(initial ? { ...initial.name } : { tr: '' });
  const [icon, setIcon] = useState<BadgeIcon>(initial?.icon ?? 'star');
  const [publisher, setPublisher] = useState(initial?.publisher ?? false);
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const tr = name.tr.trim();
    if (!tr) return setError(t('badges.nameRequired'));
    // Kimlik ilk kayıtta addan üretilir, sonra değişmez (kişilerin profilinde bu yazılı).
    const bid = initial?.id ?? badgeIdFromName(tr);
    if (bid.length < 2) return setError(t('badges.nameRequired'));
    if (taken.includes(bid)) return setError(t('badges.duplicate'));
    onSave({ id: bid, name: { ...name, tr }, icon, publisher });
  };

  return (
    <form className="form panel-form" onSubmit={submit} aria-label={t(initial ? 'badges.edit' : 'badges.new')}>
      <div className="field">
        <label htmlFor={`${id}-tr`}>{t('badges.nameTr')}</label>
        <input id={`${id}-tr`} value={name.tr} maxLength={BADGE_LIMITS.name} onChange={(e) => setName({ ...name, tr: e.target.value })} required />
      </div>
      {OTHER_LANGS.map((l) => (
        <div key={l} className="field">
          <label htmlFor={`${id}-${l}`}>{t(`badges.name_${l}`)}</label>
          <input id={`${id}-${l}`} dir={l === 'ar' ? 'rtl' : undefined} value={name[l] ?? ''} maxLength={BADGE_LIMITS.name} onChange={(e) => setName({ ...name, [l]: e.target.value })} />
        </div>
      ))}
      <div className="field">
        <label htmlFor={`${id}-i`}>{t('badges.iconLabel')}</label>
        <select id={`${id}-i`} value={icon} onChange={(e) => setIcon(e.target.value as BadgeIcon)}>
          {BADGE_ICONS.map((i) => <option key={i} value={i}>{t(`badges.icons.${i}`)}</option>)}
        </select>
      </div>
      <div className="field checkbox form-section">
        <label>
          <input type="checkbox" checked={publisher} onChange={(e) => setPublisher(e.target.checked)} /> {t('badges.publisher')}
        </label>
      </div>
      <p className="meta form-section">{t('badges.otherLangsNote')}</p>
      {error ? <p className="error form-section" role="alert">{error}</p> : null}
      <div className="row-actions actions">
        <button className="btn" type="submit" disabled={busy}>{t('badges.save')}</button>
        <button className="btn secondary" type="button" disabled={busy} onClick={onCancel}>{t('badges.cancel')}</button>
      </div>
    </form>
  );
}
