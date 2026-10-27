import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { ROLE_TEMPLATES, type PermissionGrant, type RegionScope, type Role } from '@cityjoy/shared';
import { isAdminAccount } from '@cityjoy/shared/firebase';

import { firestore, isFirebaseConfigured } from './firebase';
import { authService } from './services';

export interface PanelUser {
  uid: string;
  displayName: string;
  email?: string | null;
  grants: PermissionGrant[];
  /** Geliştirme modundaki örnek hesap; veritabanına yazamaz. */
  isDemo?: boolean;
}

interface SessionValue {
  ready: boolean;
  user: PanelUser | null;
  /** Giriş yapılmış ama hiç panel yetkisi yok. */
  noAccess: boolean;
  signInDemo(user: PanelUser): void;
  signOut(): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

function adminGrant(uid: string): PermissionGrant {
  return { id: `${uid}-admin`, uid, role: 'admin', scope: { level: 'ulke' }, modules: ROLE_TEMPLATES.admin, grantedBy: 'konsol', grantedAt: '' };
}

/**
 * Panel oturumu. Yetkiler sunucudan okunur: şimdilik admin listesi (admins koleksiyonu).
 * Diğer roller (il yöneticisi, belediye...) yetki kayıtlarıyla birlikte eklenecek.
 */
export function SessionProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(!isFirebaseConfigured);
  const [user, setUser] = useState<PanelUser | null>(null);
  const [noAccess, setNoAccess] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return authService.onChange(async (u) => {
      if (!u) {
        setUser((current) => (current?.isDemo ? current : null));
        setNoAccess(false);
      } else {
        const grants = (await isAdminAccount(firestore, u.uid)) ? [adminGrant(u.uid)] : [];
        setNoAccess(grants.length === 0);
        setUser(grants.length ? { uid: u.uid, displayName: u.displayName ?? u.email ?? '', email: u.email, grants } : null);
      }
      setReady(true);
    });
  }, []);

  const signOut = useCallback(async () => {
    setUser(null);
    setNoAccess(false);
    if (isFirebaseConfigured) await authService.signOut();
  }, []);

  return (
    <SessionContext.Provider value={{ ready, user, noAccess, signInDemo: setUser, signOut }}>
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
    isDemo: true,
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
