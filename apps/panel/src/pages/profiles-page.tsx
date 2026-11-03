import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router';
import { searchWords, SEARCH_LIMITS, type PublicProfile } from '@cityjoy/shared';
import { createFirestoreSocialRepository } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { isAdminUser, useSession } from '../lib/session';
import { t } from '../lib/t';

interface Row extends PublicProfile {
  followers: number | null;
}

/**
 * Profiller (yalnızca admin): uygulamadaki herkese açık profilleri adla arar. Yalnızca profilde herkese açık olan
 * bilgiler görünür (KVKK: telefon, doğum yılı, mahalle gösterilmez). Kaldırma işlemleri şikâyetle Moderasyon'dan yapılır.
 */
export function ProfilesPage() {
  const { user } = useSession();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);
  if (!user || !isAdminUser(user)) return <Navigate to="/" replace />;

  const search = async (e: FormEvent) => {
    e.preventDefault();
    const key = searchWords(q)[0]?.slice(0, SEARCH_LIMITS.keyLength) ?? '';
    if (key.length < SEARCH_LIMITS.minName) return;
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

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('profiles.title')}</h1>
          <p className="meta">{t('profiles.intro')}</p>
        </div>
      </header>
      <form className="toolbar" role="search" onSubmit={search}>
        <label className="sr-only" htmlFor="profile-q">{t('profiles.search')}</label>
        <input id="profile-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('profiles.placeholder')} />
        <button className="btn" type="submit">{t('profiles.search')}</button>
      </form>
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
                      {p.locationVerified ? <span className="pill ok">{t('profiles.verified')}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !error && <p className="state">{t('profiles.empty')}</p>
        )
      ) : null}
      <p className="meta">{t('profiles.moderationNote')} <Link to="/moderasyon">{t('menu.items.moderasyon')}</Link></p>
    </section>
  );
}
