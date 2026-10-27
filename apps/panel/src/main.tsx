import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, Navigate, RouterProvider } from 'react-router';

import { Shell } from './components/shell';
import { SessionProvider, useSession } from './lib/session';
import { EmergencyNumbersPage } from './pages/emergency-numbers-page';
import { LocationsPage } from './pages/locations-page';
import { LoginPage } from './pages/login-page';
import { OccupationsPage } from './pages/occupations-page';
import { ServiceCategoriesPage } from './pages/service-categories-page';
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
