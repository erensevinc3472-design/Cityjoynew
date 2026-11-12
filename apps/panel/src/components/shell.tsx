import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { canSeeModule, type Module } from '@cityjoy/shared';

import { ScopeLabel } from './scope-label';
import { hasProfileAccess } from '../pages/profile-page';
import { canSeeAudience } from '../lib/audience';
import { useCity } from '../lib/city';
import { isAdminUser, useSession, type PanelUser } from '../lib/session';
import { t } from '../lib/t';
import { useTheme } from '../lib/theme';
import { firestore } from '../lib/firebase';
import { createFirebaseStats } from '@cityjoy/shared/firebase';

/** Menü öğesi: ya bir bölüm yetkisine (module) ya da özel bir koşula (show) bağlı. Yolu olmayan "yakında" gösterilir. */
interface MenuItem {
  key: string;
  path?: string;
  module?: Module;
  show?: (user: PanelUser) => boolean;
  icon: keyof typeof ICONS;
  /** Yanında bekleyen iş sayısı gösterilir. */
  badge?: 'approvals' | 'reports';
}

const admin = (u: PanelUser) => isAdminUser(u);

/**
 * Menü işe göre gruplanır (Karar, Eren, 12 Kasım 2026; 3 Kasım'daki uygulama bölümleri düzeninin yerine):
 * Günlük işler (bekleyen sayılarıyla), İçerik, İşletme ve sosyal, Raporlar, Ayarlar (başta kapalı).
 * Her kişi yalnızca yetkili olduğu öğeleri görür; boş grup gizlenir. Henüz yapılmamış öğe menüde gösterilmez.
 */
export const MENU_GROUPS: { key: string; items: MenuItem[] }[] = [
  {
    key: 'gunluk',
    items: [
      { key: 'today', path: '/', icon: 'home', show: () => true },
      { key: 'onaylar', module: 'onaylar', path: '/onaylar', icon: 'check', badge: 'approvals' },
      { key: 'moderasyon', module: 'moderasyon', path: '/moderasyon', icon: 'shield', badge: 'reports' },
    ],
  },
  {
    key: 'icerik',
    items: [
      { key: 'vitrin', show: (u) => isAdminUser(u) || canSeeModule(u.grants, 'sehir-rehberi'), path: '/sehir-vitrini', icon: 'screen' },
      { key: 'sehir-rehberi', module: 'sehir-rehberi', path: '/sehir-rehberi', icon: 'book' },
      { key: 'gonderiler', module: 'gonderiler', path: '/duyurular', icon: 'megaphone' },
      { key: 'etkinlikler', module: 'etkinlikler', path: '/etkinlikler', icon: 'calendar' },
      { key: 'seyahat', module: 'seyahat', path: '/seyahat', icon: 'globe' },
      { key: 'yol-ustu', show: admin, path: '/yol-ustu-verisi', icon: 'road' },
      { key: 'tatil-fikirleri', show: admin, path: '/tatil-fikirleri', icon: 'sun' },
      { key: 'acil-numaralar', module: 'acil-numaralar', path: '/acil-numaralar', icon: 'phone' },
      { key: 'konumlar', module: 'konumlar', path: '/konumlar', icon: 'pin' },
    ],
  },
  {
    key: 'isletme-sosyal',
    items: [
      { key: 'isletme-dogrulama', module: 'isletme-dogrulama', path: '/isletmeler', icon: 'store' },
      { key: 'firsatlar', module: 'moderasyon', path: '/firsatlar', icon: 'ticket' },
      { key: 'profiller', show: admin, path: '/profiller', icon: 'users' },
      { key: 'bildirimler', module: 'bildirimler', path: '/bildirimler', icon: 'bell' },
      { key: 'anketler', show: admin, path: '/anketler', icon: 'check' },
      { key: 'yarismalar', show: admin, path: '/yarismalar', icon: 'badge' },
      { key: 'sponsorlar', show: admin, path: '/sponsorlar', icon: 'megaphone' },
      { key: 'hizmet-kategorileri', module: 'hizmet-kategorileri', path: '/hizmet-kategorileri', icon: 'grid' },
      { key: 'diger-ihtiyaclar', show: admin, path: '/diger-ihtiyaclar', icon: 'grid' },
      { key: 'meslekler', module: 'meslekler', path: '/meslekler', icon: 'briefcase' },
    ],
  },
  {
    key: 'raporlar',
    items: [
      { key: 'istatistikler', show: (u) => canSeeStats(u), path: '/istatistikler', icon: 'chart' },
      { key: 'kitle', show: (u) => canSeeAudience(u, isAdminUser(u)), path: '/takipciler', icon: 'users' },
      { key: 'harcama', show: admin, path: '/harcama', icon: 'gauge' },
      { key: 'islem-kayitlari', module: 'islem-kayitlari', path: '/islem-kayitlari', icon: 'file' },
    ],
  },
  {
    key: 'ayarlar',
    items: [
      { key: 'profile', show: hasProfileAccess, path: '/profil', icon: 'badge' },
      { key: 'kurumlar', module: 'kurumlar', path: '/kurumlar', icon: 'building' },
      { key: 'yetkiler', module: 'yetkiler', path: '/yetkiler', icon: 'key' },
      { key: 'sos', module: 'sos', path: '/sos-ayarlari', icon: 'alert' },
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

// Yeni menü düzeniyle anahtar değişti; Ayarlar başta kapalı.
const COLLAPSED_KEY = 'cityjoy-panel-kapali-gruplar-2';

function readCollapsed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '["ayarlar"]');
  } catch {
    return ['ayarlar'];
  }
}

type Badges = Partial<Record<NonNullable<MenuItem['badge']>, number | null>>;

export function Shell() {
  const { user, signOut } = useSession();
  const city = useCity();
  const [collapsed, setCollapsed] = useState<string[]>(readCollapsed);
  const [theme, toggleTheme] = useTheme();
  // Telefonda menü soldan açılan çekmecedir; sayfa değişince ya da Esc ile kapanır.
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();
  useEffect(() => setDrawer(false), [location.pathname]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawer(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);
  // Bekleyen onay ve şikâyet sayıları (sayım sorgusu, belge okumaz): il değişince ve en çok dakikada bir yenilenir.
  const [badges, setBadges] = useState<Badges>({});
  const [badgeTick, setBadgeTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setBadgeTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (!user || user.isDemo) return;
    let live = true;
    const s = createFirebaseStats(firestore);
    Promise.all([
      canSeeModule(user.grants, 'onaylar') ? s.pendingApprovals(city.provinceCode) : Promise.resolve(null),
      canSeeModule(user.grants, 'moderasyon') ? s.openReports(city.provinceCode) : Promise.resolve(null),
    ]).then(([approvals, reports]) => live && setBadges({ approvals, reports }));
    return () => {
      live = false;
    };
  }, [user, city.provinceCode, badgeTick]);
  if (!user) return null;

  const themeLabel = t(theme === 'dark' ? 'menu.themeLight' : 'menu.themeDark');
  const themeButton = (
    <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={themeLabel} title={themeLabel}>
      <span aria-hidden="true">◐</span>
    </button>
  );

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
        <span className="grow">{label}</span>
        {item.badge && badges[item.badge] ? (
          <b className="nav-badge" aria-label={t('menu.waiting', { count: badges[item.badge]! })}>{badges[item.badge]! > 99 ? '99+' : badges[item.badge]}</b>
        ) : null}
      </NavLink>
    ) : (
      <span key={item.key} className="nav-disabled" aria-disabled="true">
        <Icon name={item.icon} />
        <span>{label} <small>{t('overview.comingSoon')}</small></span>
      </span>
    );

  const showCity = city.national || city.provinces.length > 1;

  return (
    <div className={drawer ? 'shell drawer-open' : 'shell'}>
      <header className="topbar">
        <button type="button" className="menu-button" aria-expanded={drawer} aria-controls="panel-menu" onClick={() => setDrawer(!drawer)}>
          <span aria-hidden="true">☰</span>
          <span className="sr-only">{t('menu.open')}</span>
        </button>
        <span className="brand-mark" aria-hidden="true">C</span>
        <p className="brand grow">CityJoy</p>
        {themeButton}
      </header>
      {drawer ? <div className="drawer-backdrop" onClick={() => setDrawer(false)} aria-hidden="true" /> : null}
      <aside className="sidebar" id="panel-menu">
        <div className="brand-row">
          <span className="brand-mark" aria-hidden="true">C</span>
          <div className="grow">
            <p className="brand">CityJoy</p>
            <span className="brand-sub">{t('menu.panel')}</span>
          </div>
          {themeButton}
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
