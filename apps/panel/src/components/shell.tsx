import { NavLink, Outlet } from 'react-router';
import { canSeeModule, type Module } from '@cityjoy/shared';

import { ScopeLabel } from './scope-label';
import { useSession } from '../lib/session';
import { t } from '../lib/t';

/** Menüde sırasıyla gösterilen bölümler ve hazır olup olmadıkları. */
export const MENU: { module: Module; path?: string }[] = [
  { module: 'konumlar', path: '/konumlar' },
  { module: 'meslekler', path: '/meslekler' },
  { module: 'acil-numaralar', path: '/acil-numaralar' },
  { module: 'hizmet-kategorileri', path: '/hizmet-kategorileri' },
  { module: 'onaylar' },
  { module: 'yetkiler' },
  { module: 'islem-kayitlari' },
  { module: 'bildirimler' },
  { module: 'gonderiler' },
  { module: 'etkinlikler' },
  { module: 'hizmetler' },
  { module: 'moderasyon', path: '/moderasyon' },
  { module: 'isletme-dogrulama', path: '/isletmeler' },
];

export function Shell() {
  const { user, signOut } = useSession();
  if (!user) return null;
  // Menü yalnızca yetkiye göre süzülür; asıl kontrol sunucuda yapılır.
  const items = MENU.filter((m) => canSeeModule(user.grants, m.module));

  return (
    <div className="shell">
      <aside className="sidebar">
        <p className="brand">{t('appName')}</p>
        <nav aria-label="Ana menü">
          <NavLink to="/" end>{t('nav.overview')}</NavLink>
          {items.map((m) =>
            m.path ? (
              <NavLink key={m.module} to={m.path}>{t(`nav.${m.module}`)}</NavLink>
            ) : (
              <span key={m.module} className="nav-disabled" aria-disabled="true">
                {t(`nav.${m.module}`)} <small>{t('overview.comingSoon')}</small>
              </span>
            ),
          )}
        </nav>
        <div className="who">
          <strong>{user.displayName}</strong>
          {user.grants.map((g) => (
            <span key={g.id}>{t(`roles.${g.role}`)} · <ScopeLabel scope={g.scope} /></span>
          ))}
          <button className="btn ghost" onClick={() => signOut()}>{t('login.logout')}</button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
