import { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';

import { AuthError, type AuthErrorCode, type AuthService, type AuthUser } from '../services/types';

const CODES: Record<string, AuthErrorCode> = {
  'auth/email-already-in-use': 'email-in-use',
  'auth/invalid-email': 'invalid-email',
  'auth/weak-password': 'weak-password',
  'auth/wrong-password': 'wrong-credentials',
  'auth/user-not-found': 'wrong-credentials',
  'auth/invalid-credential': 'wrong-credentials',
  'auth/invalid-login-credentials': 'wrong-credentials',
  'auth/too-many-requests': 'too-many-requests',
  'auth/network-request-failed': 'network',
  'auth/requires-recent-login': 'requires-recent-login',
  'auth/popup-closed-by-user': 'popup-closed',
  'auth/cancelled-popup-request': 'popup-closed',
};

function toAuthError(e: unknown): AuthError {
  if (e instanceof AuthError) return e;
  const code = e instanceof FirebaseError ? (CODES[e.code] ?? 'unknown') : 'unknown';
  return new AuthError(code, e);
}

async function wrap<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw toAuthError(e);
  }
}

const toUser = (u: User): AuthUser => ({
  uid: u.uid,
  email: u.email,
  emailVerified: u.emailVerified,
  displayName: u.displayName,
});

export interface FirebaseAuthOptions {
  /** Doğrulama ve şifre sıfırlama e-postalarının dili. */
  languageCode?: () => string;
}

export function createFirebaseAuthService(auth: Auth, options: FirebaseAuthOptions = {}): AuthService & {
  /** Hesap silme: önce kimlik yeniden doğrulanır, sonra veriler, en son hesap silinir. */
  deleteAccountAndData(password: string | undefined, deleteData: (uid: string) => Promise<void>): Promise<void>;
} {
  const setLanguage = () => {
    const lang = options.languageCode?.();
    if (lang) auth.languageCode = lang;
  };
  const requireUser = () => {
    if (!auth.currentUser) throw new AuthError('wrong-credentials');
    return auth.currentUser;
  };

  async function reauthenticate(user: User, password?: string) {
    if (password && user.email) {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    } else if (user.providerData.some((p) => p.providerId === 'google.com')) {
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
    } else {
      throw new AuthError('requires-recent-login');
    }
  }

  const service = {
    currentUser: () => (auth.currentUser ? toUser(auth.currentUser) : null),
    onChange: (listener: (u: AuthUser | null) => void) => onAuthStateChanged(auth, (u) => listener(u ? toUser(u) : null)),
    signUp: (email: string, password: string, displayName: string) =>
      wrap(async () => {
        setLanguage();
        const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(user, { displayName: displayName.trim() });
        await sendEmailVerification(user);
        return toUser(user);
      }),
    signIn: (email: string, password: string) =>
      wrap(async () => toUser((await signInWithEmailAndPassword(auth, email.trim(), password)).user)),
    signInWithGoogle: () => wrap(async () => toUser((await signInWithPopup(auth, new GoogleAuthProvider())).user)),
    sendPasswordReset: (email: string) =>
      wrap(async () => {
        setLanguage();
        await sendPasswordResetEmail(auth, email.trim());
      }),
    sendEmailVerification: () =>
      wrap(async () => {
        setLanguage();
        await sendEmailVerification(requireUser());
      }),
    reload: () =>
      wrap(async () => {
        if (!auth.currentUser) return null;
        await auth.currentUser.reload();
        return toUser(auth.currentUser);
      }),
    signOut: () => wrap(() => signOut(auth)),
    deleteAccount: (password?: string) => service.deleteAccountAndData(password, async () => {}),
    deleteAccountAndData: (password: string | undefined, deleteData: (uid: string) => Promise<void>) =>
      wrap(async () => {
        const user = requireUser();
        await reauthenticate(user, password);
        await deleteData(user.uid);
        await deleteUser(user);
      }),
  };
  return service;
}
