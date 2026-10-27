import { Link } from 'react-router';
import { canSeeModule, type Action } from '@cityjoy/shared';

import { MENU } from '../components/shell';
import { ScopeLabel } from '../components/scope-label';
import { useSession } from '../lib/session';
import { t } from '../lib/t';

export function OverviewPage() {
  const { user } = useSession();
  if (!user) return null;
  const items = MENU.filter((m) => canSeeModule(user.grants, m.module));

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('overview.title')}, {user.displayName}</h1>
          <p className="meta">
            {t('overview.scope')}:{' '}
            {user.grants.map((g, i) => (
              <span key={g.id}>{i ? ', ' : ''}<ScopeLabel scope={g.scope} /></span>
            ))}
          </p>
        </div>
      </header>
      <h2>{t('overview.modules')}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">{t('overview.colModule')}</th>
              <th scope="col">{t('overview.colActions')}</th>
              <th scope="col">{t('overview.colStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => {
              const actions = new Set<Action>(user.grants.flatMap((g) => g.modules[m.module] ?? []));
              return (
                <tr key={m.module}>
                  <td>{m.path ? <Link to={m.path}>{t(`nav.${m.module}`)}</Link> : t(`nav.${m.module}`)}</td>
                  <td>{[...actions].map((a) => t(`actions.${a}`)).join(', ')}</td>
                  <td><span className={m.path ? 'pill ok' : 'pill'}>{m.path ? t('overview.ready') : t('overview.comingSoon')}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
