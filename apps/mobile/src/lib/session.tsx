import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import type { AuthUser, UserProfile } from '@cityjoy/shared';

import { isFirebaseConfigured } from './firebase-config';
import { authService, profileRepository } from './services';

interface SessionValue {
  /** Oturum ve profil ilk kez yüklendi mi? */
  ready: boolean;
  user: AuthUser | null;
  /** Giriş yapılmış ama profil oluşturulmamışsa null. */
  profile: UserProfile | null;
  /** Profil okunamadı (ör. bağlantı yok). */
  profileError: boolean;
  refreshProfile(): Promise<UserProfile | null>;
  refreshUser(): Promise<void>;
  /** Giriş/kayıt sonrası çağrılır: profil yüklenmeden yönlendirme yapılmaz. */
  adopt(user: AuthUser | null): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(!isFirebaseConfigured);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState(false);

  const loadProfile = useCallback(async (uid: string) => {
    try {
      const p = await profileRepository.get(uid);
      setProfile(p);
      setProfileError(false);
      return p;
    } catch {
      setProfileError(true);
      return null;
    }
  }, []);

  // Kullanıcı ve profili birlikte güncellenir; aradaki anda "profil yok" sanılıp yanlış ekrana gidilmez.
  const adopt = useCallback(
    async (u: AuthUser | null) => {
      if (u) await loadProfile(u.uid);
      else setProfile(null);
      setUser(u);
    },
    [loadProfile],
  );

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return authService.onChange(async (u) => {
      await adopt(u);
      setReady(true);
    });
  }, [adopt]);

  const refreshProfile = useCallback(async () => (user ? loadProfile(user.uid) : null), [user, loadProfile]);
  const refreshUser = useCallback(async () => {
    setUser(await authService.reload());
  }, []);

  return (
    <SessionContext.Provider value={{ ready, user, profile, profileError, refreshProfile, refreshUser, adopt }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession, SessionProvider içinde kullanılmalı');
  return ctx;
}
