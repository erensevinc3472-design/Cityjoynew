import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { searchWords, SEARCH_LIMITS, type BadgeDefinition, type PublicProfile } from '@cityjoy/shared';
import { createBadgeAdmin, createFirestoreSocialRepository } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { isAdminUser, useSession } from '../lib/session';
import { t } from '../lib/t';
import { Intro } from '../components/intro';
import { SuspendControl, SuspendedList } from '../components/suspend-control';
import { BadgeControl, BadgePills } from '../components/badge-control';

interface Row extends PublicProfile {
  followers: number | null;
}

/**
 * Profiller (yalnızca admin): uygulamadaki herkese açık profilleri adla arar. Yalnızca profilde herkese açık olan
 * bilgiler görünür (KVKK: telefon, doğum yılı, mahalle gösterilmez). Kaldırma işlemleri şikâyetle Moderasyon'dan yapılır.
 */
export function ProfilesPage() {
  const { user } = useSession();
  // Genel aramadan gelince (?q=) ad kutusu dolu açılır ve arama hemen yapılır.
  const [params] = useSearchParams();
  const [q, setQ] = useState(() => params.get('q') ?? '');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [refresh, setRefresh] = useState(0);
  const [lastKey, setLastKey] = useState('');
  // Rozet listesi (Rozet ver için) sayfa açılınca bir kez okunur.
  const [badgeDefs, setBadgeDefs] = useState<BadgeDefinition[]>([]);
  useEffect(() => {
    if (!user || !isAdminUser(user)) return;
    createBadgeAdmin(firestore, user.uid)
      .load()
      .then((r) => setBadgeDefs(r.items), () => setBadgeDefs([]));
  }, [user]);
  useEffect(() => {
    const key = searchWords(params.get('q') ?? '')[0]?.slice(0, SEARCH_LIMITS.keyLength) ?? '';
    if (key.length < SEARCH_LIMITS.minName || !user || !isAdminUser(user)) return;
    setLastKey(key);
    find(key);
    // Yalnızca sayfa açılışında.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!user || !isAdminUser(user)) return <Navigate to="/" replace />;

  const search = async (e: FormEvent) => {
    e.preventDefault();
    const key = searchWords(q)[0]?.slice(0, SEARCH_LIMITS.keyLength) ?? '';
    if (key.length < SEARCH_LIMITS.minName) return;
    setLastKey(key);
    await find(key);
  };

  const find = async (key: string) => {
    setError(false);
    setRows(null);
    try {
      const repo = createFirestoreSocialRepository(firestore);
      const found = await repo.searchPeople(key);
      setRows(await Promise.all(found.map(async (p) => ({ ...p, followers: await repo.counts(p.uid).then((c) => c.followers, () => null) }))));
    } catch {
      setError(true);
      setRows([]);
    }
  };

  const done = (ok: boolean) => {
    setMessage(ok ? { kind: 'ok', text: t('suspend.saved') } : { kind: 'error', text: t('suspend.error') });
    if (ok) {
      setRefresh((n) => n + 1);
      if (lastKey) find(lastKey);
    }
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('profiles.title')}</h1>
          <Intro text={t('profiles.intro')} />
        </div>
      </header>
      <form className="toolbar" role="search" onSubmit={search}>
        <label className="sr-only" htmlFor="profile-q">{t('profiles.search')}</label>
        <input id="profile-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('profiles.placeholder')} />
        <button className="btn" type="submit">{t('profiles.search')}</button>
      </form>
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {error ? <p className="error">{t('profiles.error')}</p> : null}
      {rows ? (
        rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('profiles.colName')}</th>
                  <th scope="col">{t('profiles.colBio')}</th>
                  <th scope="col">{t('profiles.colFollowers')}</th>
                  <th scope="col">{t('profiles.colState')}</th>
                  {user.isDemo ? null : <th scope="col"><span className="sr-only">{t('moderation.actions')}</span></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.uid}>
                    <td>
                      <span className="person">
                        {p.photo ? <img src={p.photo.url} alt="" /> : <span className="who-avatar" aria-hidden="true">{p.displayName.slice(0, 1)}</span>}
                        {p.displayName}
                      </span>
                    </td>
                    <td>{p.bioRemoved ? <span className="meta">{t('profiles.bioRemoved')}</span> : p.bio || <span className="meta">—</span>}</td>
                    <td className="num">{p.followers ?? '—'}</td>
                    <td>
                      {p.isPrivate ? <span className="pill">{t('profiles.private')}</span> : null}{' '}
                      {p.locationVerified ? <span className="pill ok">{t('profiles.verified')}</span> : null}{' '}
                      {p.suspended ? <span className="pill warn">{t('suspend.pill')}</span> : null}{' '}
                      <BadgePills ids={p.badges} defs={badgeDefs} />
                    </td>
                    {user.isDemo ? null : (
                      <td>
                        <div className="row-actions start">
                          {badgeDefs.length && !p.suspended ? (
                            <BadgeControl
                              actorUid={user.uid}
                              profile={p}
                              defs={badgeDefs}
                              onDone={(ok, badges) => {
                                setMessage(ok ? { kind: 'ok', text: t('badges.given') } : { kind: 'error', text: t('badges.saveError') });
                                if (ok) setRows((rs) => (rs ?? []).map((r) => (r.uid === p.uid ? { ...r, badges: badges ?? [] } : r)));
                              }}
                            />
                          ) : null}
                          <SuspendControl uid={p.uid} name={p.displayName} suspended={!!p.suspended} onDone={done} />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !error && <p className="state">{t('profiles.empty')}</p>
        )
      ) : null}
      {user.isDemo ? null : <SuspendedList refreshKey={refresh} onDone={done} />}
      <p className="meta">{t('profiles.moderationNote')} <Link to="/moderasyon">{t('menu.items.moderasyon')}</Link></p>
    </section>
  );
}
