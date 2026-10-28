import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import {
  isGrantActive,
  isMemberActive,
  isOrganizationActive,
  membershipToGrant,
  ROLE_TEMPLATES,
  type AuthUser,
  type Organization,
  type OrganizationMember,
  type PermissionGrant,
  type RegionScope,
  type Role,
} from '@cityjoy/shared';
import { isAdminAccount, loadOwnGrants, loadOwnMemberships } from '@cityjoy/shared/firebase';

import { firebaseAuth, firestore, isFirebaseConfigured } from './firebase';
import { authService } from './services';

export interface PanelUser {
  uid: string;
  displayName: string;
  email?: string | null;
  grants: PermissionGrant[];
  /** Kurum görevleri (kurum yöneticisi personel sayfasını bunlardan açar). */
  memberships: { org: Organization; member: OrganizationMember }[];
  /** Geliştirme modundaki örnek hesap; veritabanına yazamaz. */
  isDemo?: boolean;
}

interface SessionValue {
  ready: boolean;
  user: PanelUser | null;
  /** Giriş yapılmış ama panel yetkisi yok (e-posta doğrulanmamış olabilir). */
  noAccess: { email: string; emailVerified: boolean } | null;
  signInDemo(user: PanelUser): void;
  /** E-posta doğrulandıktan sonra yetkileri yeniden okur. */
  refresh(): Promise<void>;
  signOut(): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

function adminGrant(uid: string, email: string): PermissionGrant {
  return { id: `${uid}-admin`, email, role: 'admin', scope: { level: 'ulke' }, modules: ROLE_TEMPLATES.admin, grantedBy: 'konsol', grantedAt: '' };
}

/**
 * Yetkiler: admin listesi (admins, Firebase konsolundan), e-postaya verilen kişi yetkileri (grants) ve kurum
 * görevleri (orgMembers). Kişi yetkileri ve kurum görevleri yalnızca doğrulanmış e-postada geçer (PROJE.md 6.7).
 */
async function loadAccess(u: AuthUser): Promise<Pick<PanelUser, 'grants' | 'memberships'>> {
  const email = u.email?.toLowerCase() ?? '';
  const now = new Date();
  const isAdmin = await isAdminAccount(firestore, u.uid);
  if (!email || !u.emailVerified) return { grants: isAdmin ? [adminGrant(u.uid, email)] : [], memberships: [] };
  const [own, memberships] = await Promise.all([
    loadOwnGrants(firestore, email).catch(() => []),
    loadOwnMemberships(firestore, email).catch(() => []),
  ]);
  const active = memberships.filter(({ org, member }) => isOrganizationActive(org, now) && isMemberActive(member, now));
  return {
    grants: [
      ...(isAdmin ? [adminGrant(u.uid, email)] : []),
      ...own.filter((g) => isGrantActive(g, now)),
      ...active.map(({ org, member }) => membershipToGrant(org, member)),
    ],
    memberships: active,
  };
}

/** Panel oturumu. Menü yetkilere göre süzülür, asıl denetimi veritabanı kuralları yapar. */
export function SessionProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(!isFirebaseConfigured);
  const [user, setUser] = useState<PanelUser | null>(null);
  const [noAccess, setNoAccess] = useState<SessionValue['noAccess']>(null);

  const adopt = useCallback(async (u: AuthUser | null) => {
    if (!u) {
      setUser((current) => (current?.isDemo ? current : null));
      setNoAccess(null);
    } else {
      const access = await loadAccess(u);
      const displayName = u.displayName ?? u.email ?? '';
      setNoAccess(access.grants.length ? null : { email: u.email ?? '', emailVerified: u.emailVerified });
      setUser(access.grants.length ? { uid: u.uid, displayName, email: u.email, ...access } : null);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return authService.onChange(adopt);
  }, [adopt]);

  const refresh = useCallback(async () => {
    const current = firebaseAuth.currentUser;
    if (!current) return;
    await current.reload();
    // Doğrulama bilgisi kimlik belirtecine yeniden alınınca geçer (kurallar belirteçteki bilgiye bakar).
    await current.getIdToken(true);
    await adopt({ uid: current.uid, email: current.email, emailVerified: current.emailVerified, displayName: current.displayName });
  }, [adopt]);

  const signOut = useCallback(async () => {
    setUser(null);
    setNoAccess(null);
    if (isFirebaseConfigured) await authService.signOut();
  }, []);

  return (
    <SessionContext.Provider value={{ ready, user, noAccess, signInDemo: setUser, refresh, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession, SessionProvider içinde kullanılmalı');
  return ctx;
}

/** Admin mi (konsoldan eklenen admin listesi)? */
export const isAdminUser = (user: PanelUser | null | undefined) => !!user?.grants.some((g) => g.role === 'admin');

export const DEMO_LOGIN_ENABLED = import.meta.env.DEV || import.meta.env.VITE_DEMO_LOGIN === '1';

function demo(uid: string, displayName: string, role: Role, scope: RegionScope): PanelUser {
  const email = `${uid}@ornek.com`;
  return {
    uid,
    displayName,
    email,
    isDemo: true,
    memberships: [],
    grants: [{ id: `${uid}-1`, email, role, scope, modules: ROLE_TEMPLATES[role], grantedBy: 'ornek', grantedAt: '2026-01-01T00:00:00Z' }],
  };
}

/**
 * Örnek belediye: Nilüfer Belediyesi kurum görevlisi (kurum yöneticisi). Kurumunda Seyahat bölümü açık; belediye
 * panelinin (Başkanlarla Keşif tanıtımı ve rotaları) nasıl göründüğünü gösterir. Örnek hesap veritabanına yazamaz.
 */
function demoMunicipality(): PanelUser {
  const user = demo('ornek-belediye', 'Örnek Nilüfer Belediyesi', 'belediye', { level: 'ilce', provinceCode: '16', districtId: '16-nilufer' });
  const org: Organization = {
    id: 'bld-16-nilufer',
    name: 'Nilüfer Belediyesi',
    kind: 'ilce-belediyesi',
    scope: { level: 'ilce', provinceCode: '16', districtId: '16-nilufer' },
    modules: ['gonderiler', 'etkinlikler', 'bildirimler', 'hizmetler', 'seyahat'],
    officialEmail: user.email!,
    status: 'aktif',
    createdBy: 'ornek',
    createdAt: '2026-01-01T00:00:00Z',
  };
  const member: OrganizationMember = {
    orgId: org.id,
    email: user.email!,
    displayName: user.displayName,
    isOrgAdmin: true,
    assignments: { seyahat: ['goruntule', 'ekle', 'duzenle', 'sil'] },
  };
  const g = user.grants[0]!;
  return { ...user, memberships: [{ org, member }], grants: [{ ...g, modules: { ...g.modules, seyahat: ['goruntule', 'ekle', 'duzenle', 'sil'] } }] };
}

export const DEMO_USERS: PanelUser[] = [
  demo('ornek-admin', 'Örnek Admin', 'admin', { level: 'ulke' }),
  demo('ornek-il', 'Örnek Bursa İl Yöneticisi', 'il-yoneticisi', { level: 'il', provinceCode: '16' }),
  demoMunicipality(),
  demo('ornek-muhtar', 'Örnek Ataevler Muhtarlığı', 'muhtar', {
    level: 'mahalle',
    provinceCode: '16',
    districtId: '16-nilufer',
    neighbourhoodId: '16-nilufer-ataevler',
  }),
];
