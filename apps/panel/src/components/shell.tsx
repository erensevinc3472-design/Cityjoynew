import { useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';
import { canSeeModule, type Module } from '@cityjoy/shared';

import { ScopeLabel } from './scope-label';
import { hasProfileAccess } from '../pages/profile-page';
import { canSeeContentStats } from '../pages/content-stats-page';
import { canSeePress } from '../pages/press-page';
import { canSeeAudience } from '../lib/audience';
import { useCity } from '../lib/city';
import { isAdminUser, useSession, type PanelUser } from '../lib/session';
import { t } from '../lib/t';

/** Menü öğesi: ya bir bölüm yetkisine (module) ya da özel bir koşula (show) bağlı. Yolu olmayan "yakında" gösterilir. */
interface MenuItem {
  key: string;
  path?: string;
  module?: Module;
  show?: (user: PanelUser) => boolean;
  icon: keyof typeof ICONS;
}

const admin = (u: PanelUser) => isAdminUser(u);

/**
 * Menü uygulamanın bölümleriyle aynı gruplanır (Karar, Eren, 3 Kasım 2026): Benim Şehrim, Seyahat, Sosyal, Acil,
 * İşletmeler ve profiller, Yönetim. Her kişi yalnızca yetkili olduğu öğeleri görür; boş grup gizlenir.
 */
export const MENU_GROUPS: { key: string; items: MenuItem[] }[] = [
  {
    key: 'sehrim',
    items: [
      { key: 'konumlar', module: 'konumlar', path: '/konumlar', icon: 'pin' },
      { key: 'sehir-rehberi', module: 'sehir-rehberi', path: '/sehir-rehberi', icon: 'book' },
      { key: 'gonderiler', module: 'gonderiler', path: '/duyurular', icon: 'megaphone' },
      { key: 'etkinlikler', module: 'etkinlikler', path: '/etkinlikler', icon: 'calendar' },
      { key: 'hizmetler', module: 'hizmetler', icon: 'tool' },
    ],
  },
  {
    key: 'seyahat',
    items: [
      { key: 'seyahat', module: 'seyahat', path: '/seyahat', icon: 'globe' },
      { key: 'yol-ustu', show: admin, path: '/yol-ustu-verisi', icon: 'road' },
      { key: 'tatil-fikirleri', show: admin, path: '/tatil-fikirleri', icon: 'sun' },
    ],
  },
  {
    key: 'sosyal',
    items: [
      { key: 'moderasyon', module: 'moderasyon', path: '/moderasyon', icon: 'shield' },
      { key: 'bildirimler', module: 'bildirimler', path: '/bildirimler', icon: 'bell' },
      { key: 'anketler', show: admin, path: '/anketler', icon: 'check' },
      { key: 'yarismalar', show: admin, path: '/yarismalar', icon: 'badge' },
    ],
  },
  {
    key: 'acil',
    items: [
      { key: 'acil-numaralar', module: 'acil-numaralar', path: '/acil-numaralar', icon: 'phone' },
      { key: 'sos', module: 'sos', path: '/sos-ayarlari', icon: 'alert' },
    ],
  },
  {
    key: 'isletmeler',
    items: [
      { key: 'isletme-dogrulama', module: 'isletme-dogrulama', path: '/isletmeler', icon: 'store' },
      { key: 'onaylar', module: 'onaylar', path: '/onaylar', icon: 'check' },
      { key: 'firsatlar', module: 'moderasyon', path: '/firsatlar', icon: 'ticket' },
      { key: 'profiller', show: admin, path: '/profiller', icon: 'users' },
      { key: 'hizmet-kategorileri', module: 'hizmet-kategorileri', path: '/hizmet-kategorileri', icon: 'grid' },
      { key: 'diger-ihtiyaclar', show: admin, path: '/diger-ihtiyaclar', icon: 'grid' },
      { key: 'meslekler', module: 'meslekler', path: '/meslekler', icon: 'briefcase' },
    ],
  },
  {
    key: 'yonetim',
    items: [
      { key: 'profile', show: hasProfileAccess, path: '/profil', icon: 'badge' },
      { key: 'kurumlar', module: 'kurumlar', path: '/kurumlar', icon: 'building' },
      { key: 'yetkiler', module: 'yetkiler', path: '/yetkiler', icon: 'key' },
      { key: 'islem-kayitlari', module: 'islem-kayitlari', path: '/islem-kayitlari', icon: 'file' },
      { key: 'sinirlar', show: admin, path: '/sinirlar', icon: 'gauge' },
    ],
  },
];

export function visibleItems(user: PanelUser, items: MenuItem[]): MenuItem[] {
  return items.filter((m) => (m.show ? m.show(user) : m.module ? canSeeModule(user.grants, m.module) : false));
}

/** İstatistikleri görebilen: gönderi ya da işletme verisini okuyabilen herkes. */
export function canSeeStats(user: PanelUser): boolean {
  return canSeeModule(user.grants, 'moderasyon') || canSeeModule(user.grants, 'isletme-dogrulama');
}

const COLLAPSED_KEY = 'cityjoy-panel-kapali-gruplar';

function readCollapsed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function Shell() {
  const { user, signOut } = useSession();
  const city = useCity();
  const [collapsed, setCollapsed] = useState<string[]>(readCollapsed);
  if (!user) return null;

  const toggle = (key: string) => {
    const next = collapsed.includes(key) ? collapsed.filter((k) => k !== key) : [...collapsed, key];
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
    } catch {
      // Saklanamazsa yalnızca bu oturumda kapalı kalır.
    }
  };

  const link = (item: MenuItem, label: ReactNode) =>
    item.path ? (
      <NavLink key={item.key} to={item.path} end={item.path === '/'}>
        <Icon name={item.icon} />
        <span>{label}</span>
      </NavLink>
    ) : (
      <span key={item.key} className="nav-disabled" aria-disabled="true">
        <Icon name={item.icon} />
        <span>{label} <small>{t('overview.comingSoon')}</small></span>
      </span>
    );

  const showCity = city.national || city.provinces.length > 1;
  const showcase = isAdminUser(user) || canSeeModule(user.grants, 'sehir-rehberi');

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-row">
          <span className="brand-mark" aria-hidden="true">C</span>
          <div>
            <p className="brand">CityJoy</p>
            <span className="brand-sub">{t('menu.panel')}</span>
          </div>
        </div>

        {showCity ? (
          <label className="city-picker">
            <span>{t('menu.city')}</span>
            <select value={city.provinceCode} onChange={(e) => city.setProvinceCode(e.target.value)}>
              {city.national ? <option value="">{t('scope.ulke')}</option> : null}
              {city.provinces.map((p) => (
                <option key={p.code} value={p.code}>{p.name}</option>
              ))}
            </select>
          </label>
        ) : null}

        <nav aria-label={t('menu.label')}>
          {link({ key: 'today', path: '/', icon: 'home' }, t('menu.today'))}
          {canSeePress(user) ? link({ key: 'basin', path: '/basin-masasi', icon: 'calendar' }, t('menu.press')) : null}
          {canSeeStats(user) ? link({ key: 'stats', path: '/istatistikler', icon: 'chart' }, t('menu.stats')) : null}
          {canSeeAudience(user, isAdminUser(user)) ? link({ key: 'kitle', path: '/takipciler', icon: 'users' }, t('menu.audience')) : null}
          {canSeeContentStats(user, isAdminUser(user)) ? link({ key: 'icerik', path: '/icerik-performansi', icon: 'megaphone' }, t('menu.content')) : null}
          {showcase ? link({ key: 'vitrin', path: '/sehir-vitrini', icon: 'screen' }, t('menu.showcase')) : null}

          {MENU_GROUPS.map((g) => {
            const items = visibleItems(user, g.items);
            if (!items.length) return null;
            const open = !collapsed.includes(g.key);
            return (
              <div key={g.key} className="nav-group">
                <button type="button" className="nav-group-head" aria-expanded={open} onClick={() => toggle(g.key)}>
                  {t(`menu.groups.${g.key}`)}
                  <span aria-hidden="true">{open ? '−' : '+'}</span>
                </button>
                {open ? items.map((m) => link(m, t(`menu.items.${m.key}`))) : null}
              </div>
            );
          })}
        </nav>

        <div className="who">
          <span className="who-avatar" aria-hidden="true">{user.displayName.slice(0, 1).toLocaleUpperCase('tr')}</span>
          <div>
            <strong>{user.displayName}</strong>
            {user.grants.map((g) => (
              <span key={g.id}>{t(`roles.${g.role}`)} · <ScopeLabel scope={g.scope} /></span>
            ))}
            <button className="btn ghost" onClick={() => signOut()}>{t('login.logout')}</button>
          </div>
        </div>
      </aside>
      <main className="content">
        {/* İl değişince sayfa yeni ille baştan açılır. */}
        <Outlet key={city.provinceCode} />
      </main>
    </div>
  );
}

const ICONS = {
  home: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  screen: 'M3 5h18v12H3zM8 21h8M12 17v4',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3ZM5 17a3 3 0 0 1 3-3h11',
  megaphone: 'M4 10v4h3l6 4V6l-6 4ZM17 9c1.2 1.6 1.2 4.4 0 6',
  calendar: 'M4 5h16v15H4zM4 10h16M9 3v4M15 3v4',
  tool: 'M14 6a4 4 0 0 0 5 5l-9 9-3-3 9-9a4 4 0 0 0-2-2Z',
  globe: 'M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  road: 'M8 3 5 21M16 3l3 18M12 5v2M12 11v2M12 17v2',
  ticket: 'M4 7h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4ZM14 7v12',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6Z',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4ZM10 21h4',
  phone: 'M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2 4.6 1.4V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.4l1.4 4.6Z',
  alert: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v6M12 16v.5',
  store: 'M4 9l1.5-5h13L20 9M4 9h16v11H4zM9 20v-6h6v6',
  check: 'M5 12l4 4 10-10',
  users: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20c0-3 3-5 6-5s6 2 6 5M16 5a3 3 0 0 1 0 6M18 15c2 .6 3 2.4 3 5',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  briefcase: 'M4 7h16v12H4zM9 7V4h6v3M4 12h16',
  badge: 'M4 4h16v16H4zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM7 18c1-2.5 3-3.5 5-3.5s4 1 5 3.5',
  building: 'M4 21V8l8-5 8 5v13M9 21v-6h6v6M4 21h16',
  key: 'M14 10a4 4 0 1 0-1 2.7L20 20M17 17l2-2',
  file: 'M7 3h7l5 5v13H7ZM14 3v5h5M10 13h6M10 17h4',
  gauge: 'M4 16a8 8 0 1 1 16 0M12 16l4-5',
} as const;

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}
