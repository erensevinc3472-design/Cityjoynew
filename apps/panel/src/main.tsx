import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, Navigate, RouterProvider } from 'react-router';

import { Shell } from './components/shell';
import { SessionProvider, useSession } from './lib/session';
import { AnnouncementsPage } from './pages/announcements-page';
import { ApprovalsPage } from './pages/approvals-page';
import { AuditLogPage } from './pages/audit-log-page';
import { BusinessesPage } from './pages/businesses-page';
import { CityGuidePage } from './pages/city-guide-page';
import { RoadsidePage } from './pages/roadside-page';
import { HolidayPage } from './pages/holiday-page';
import { SponsorsPage } from './pages/sponsors-page';
import { ShowcasePage } from './pages/showcase-page';
import { DealsPage } from './pages/deals-page';
import { TravelPage } from './pages/travel-page';
import { EmergencyNumbersPage } from './pages/emergency-numbers-page';
import { EventsPage } from './pages/events-page';
import { GrantsPage } from './pages/grants-page';
import { LocationsPage } from './pages/locations-page';
import { LoginPage } from './pages/login-page';
import { ModerationPage } from './pages/moderation-page';
import { OccupationsPage } from './pages/occupations-page';
import { OrganizationsPage } from './pages/organizations-page';
import { ProfilePage } from './pages/profile-page';
import { ServiceCategoriesPage } from './pages/service-categories-page';
import { NeedsPage } from './pages/needs-page';
import { ContestsPage, PollsPage } from './pages/community-page';
import { SosSettingsPage } from './pages/sos-settings-page';
import { LimitsPage } from './pages/limits-page';
import { BadgesPage } from './pages/badges-page';
import { DataSourcesPage } from './pages/data-sources-page';
import { BillingPage } from './pages/billing-page';
import { MembershipsPage } from './pages/memberships-page';
import { NotificationsPage } from './pages/notifications-page';
import { TodayPage } from './pages/today-page';
import { StatsPage } from './pages/stats-page';
import { ProfilesPage } from './pages/profiles-page';
import { AudiencePage } from './pages/audience-page';
import { CityProvider } from './lib/city';
import { applyStoredTheme } from './lib/theme';
import './styles.css';

applyStoredTheme();

function RequireUser({ children }: { children: React.ReactNode }) {
  const { ready, user } = useSession();
  if (!ready) return null;
  return user ? children : <Navigate to="/giris" replace />;
}

// Hash yönlendirme: panel herhangi bir statik barındırmada ek ayar gerekmeden çalışır.
const router = createHashRouter([
  { path: '/giris', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireUser>
        <Shell />
      </RequireUser>
    ),
    children: [
      { index: true, element: <TodayPage /> },
      { path: 'istatistikler', element: <StatsPage /> },
      { path: 'profiller', element: <ProfilesPage /> },
      { path: 'rozetler', element: <BadgesPage /> },
      { path: 'veri-kaynaklari', element: <DataSourcesPage /> },
      { path: 'takipciler', element: <AudiencePage /> },
      { path: 'konumlar', element: <LocationsPage /> },
      { path: 'meslekler', element: <OccupationsPage /> },
      { path: 'acil-numaralar', element: <EmergencyNumbersPage /> },
      { path: 'hizmet-kategorileri', element: <ServiceCategoriesPage /> },
      { path: 'diger-ihtiyaclar', element: <NeedsPage /> },
      { path: 'anketler', element: <PollsPage /> },
      { path: 'yarismalar', element: <ContestsPage /> },
      { path: 'sponsorlar', element: <SponsorsPage /> },
      { path: 'isletmeler', element: <BusinessesPage /> },
      { path: 'moderasyon', element: <ModerationPage /> },
      { path: 'sos-ayarlari', element: <SosSettingsPage /> },
      { path: 'sinirlar', element: <LimitsPage /> },
      { path: 'harcama', element: <BillingPage /> },
      { path: 'uyelikler', element: <MembershipsPage /> },
      { path: 'bildirimler', element: <NotificationsPage /> },
      { path: 'onaylar', element: <ApprovalsPage /> },
      { path: 'duyurular', element: <AnnouncementsPage /> },
      { path: 'etkinlikler', element: <EventsPage /> },
      { path: 'sehir-rehberi', element: <CityGuidePage /> },
      { path: 'sehir-vitrini', element: <ShowcasePage /> },
      { path: 'firsatlar', element: <DealsPage /> },
      { path: 'yol-ustu-verisi', element: <RoadsidePage /> },
      { path: 'seyahat', element: <TravelPage /> },
      { path: 'tatil-fikirleri', element: <HolidayPage /> },
      { path: 'kurumlar', element: <OrganizationsPage /> },
      { path: 'profil', element: <ProfilePage /> },
      { path: 'yetkiler', element: <GrantsPage /> },
      { path: 'islem-kayitlari', element: <AuditLogPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <CityProvider>
        <RouterProvider router={router} />
      </CityProvider>
    </SessionProvider>
  </StrictMode>,
);
