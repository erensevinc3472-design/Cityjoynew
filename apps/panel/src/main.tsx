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
import { SosSettingsPage } from './pages/sos-settings-page';
import { NotificationsPage } from './pages/notifications-page';
import { OverviewPage } from './pages/overview-page';
import './styles.css';

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
      { index: true, element: <OverviewPage /> },
      { path: 'konumlar', element: <LocationsPage /> },
      { path: 'meslekler', element: <OccupationsPage /> },
      { path: 'acil-numaralar', element: <EmergencyNumbersPage /> },
      { path: 'hizmet-kategorileri', element: <ServiceCategoriesPage /> },
      { path: 'isletmeler', element: <BusinessesPage /> },
      { path: 'moderasyon', element: <ModerationPage /> },
      { path: 'sos-ayarlari', element: <SosSettingsPage /> },
      { path: 'bildirimler', element: <NotificationsPage /> },
      { path: 'onaylar', element: <ApprovalsPage /> },
      { path: 'duyurular', element: <AnnouncementsPage /> },
      { path: 'etkinlikler', element: <EventsPage /> },
      { path: 'sehir-rehberi', element: <CityGuidePage /> },
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
      <RouterProvider router={router} />
    </SessionProvider>
  </StrictMode>,
);
