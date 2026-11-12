import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { Alert, AppState } from 'react-native';
import { AuthError, type AuthUser, type UserProfile } from '@cityjoy/shared';

import i18n from './i18n';

import { isFirebaseConfigured } from './firebase-config';
import { reconcileOfficialFollows } from './official-follow-sync';
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

// Açılış sayfası (Eren, 12 Kasım 2026): kayıt ya da girişten hemen sonra ana sayfa açılır; uygulama sonraki açılışlarda
// (oturum telefonda zaten açıkken) Keşfet'le başlar. null: ilk oturum bilgisi henüz gelmedi.
let restoredStart: boolean | null = null;
/** Uygulama açık bir oturumla başladıysa ve açılış yönlendirmesi henüz yapılmadıysa true. */
export const startsWithRestoredSession = () => restoredStart === true;
/** Açılış yönlendirmesi yapıldı; aynı çalışmada sonraki yönlendirmeler ana sayfaya gider. */
export const consumeRestoredStart = () => {
  restoredStart = false;
};

export function SessionProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(!isFirebaseConfigured);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState(false);

  const loadProfile = useCallback(async (uid: string) => {
    try {
      const p = await profileRepository.get(uid);
      setProfile(p);
      // Konum değiştiyse resmî takiplerin sayıları arka planda yeni mahalleye taşınır.
      if (p) void reconcileOfficialFollows(p);
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
      if (restoredStart === null) restoredStart = !!u;
      else if (!u) restoredStart = false;
      await adopt(u);
      setReady(true);
    });
  }, [adopt]);

  // Hesap askıya alındıysa açık oturum da kapanır: açılışta ve uygulamaya her dönüşte hesap yeniden denetlenir.
  const uid = user?.uid;
  useEffect(() => {
    if (!isFirebaseConfigured || !uid) return;
    const check = () =>
      authService.reload().catch(async (e) => {
        if (!(e instanceof AuthError) || e.code !== 'account-suspended') return;
        await authService.signOut().catch(() => {});
        await adopt(null);
        Alert.alert(i18n.t('errors.accountSuspended'));
      });
    check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, [uid, adopt]);

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
