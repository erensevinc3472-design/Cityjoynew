import { createContext, useContext, useState, type PropsWithChildren } from 'react';
import { ROLE_TEMPLATES, type PermissionGrant, type Role, type RegionScope } from '@cityjoy/shared';

export interface PanelUser {
  uid: string;
  displayName: string;
  grants: PermissionGrant[];
}

interface SessionValue {
  user: PanelUser | null;
  signInDemo(user: PanelUser): void;
  signOut(): void;
}

const SessionContext = createContext<SessionValue | null>(null);

/**
 * Oturum. Firebase bağlanınca gerçek giriş ve sunucudan okunan yetkiler buraya gelecek.
 * Şimdilik yalnızca geliştirme modunda örnek hesaplar vardır.
 */
export function SessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<PanelUser | null>(null);
  return (
    <SessionContext.Provider value={{ user, signInDemo: setUser, signOut: () => setUser(null) }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession, SessionProvider içinde kullanılmalı');
  return ctx;
}

export const DEMO_LOGIN_ENABLED = import.meta.env.DEV || import.meta.env.VITE_DEMO_LOGIN === '1';

function demo(uid: string, displayName: string, role: Role, scope: RegionScope): PanelUser {
  return {
    uid,
    displayName,
    grants: [
      { id: `${uid}-1`, uid, role, scope, modules: ROLE_TEMPLATES[role], grantedBy: 'ornek', grantedAt: '2026-01-01T00:00:00Z' },
    ],
  };
}

export const DEMO_USERS: PanelUser[] = [
  demo('ornek-admin', 'Örnek Admin', 'admin', { level: 'ulke' }),
  demo('ornek-il', 'Örnek Bursa İl Yöneticisi', 'il-yoneticisi', { level: 'il', provinceCode: '16' }),
  demo('ornek-belediye', 'Örnek Nilüfer Belediyesi', 'belediye', { level: 'ilce', provinceCode: '16', districtId: '16-nilufer' }),
  demo('ornek-muhtar', 'Örnek Ataevler Muhtarlığı', 'muhtar', {
    level: 'mahalle',
    provinceCode: '16',
    districtId: '16-nilufer',
    neighbourhoodId: '16-nilufer-ataevler',
  }),
];
