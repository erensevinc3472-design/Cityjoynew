import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, Navigate, RouterProvider } from 'react-router';

import { Shell } from './components/shell';
import { SessionProvider, useSession } from './lib/session';
import { LocationsPage } from './pages/locations-page';
import { LoginPage } from './pages/login-page';
import { OverviewPage } from './pages/overview-page';
import './styles.css';

function RequireUser({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
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
