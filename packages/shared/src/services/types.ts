import type { LanguageCode } from '../i18n/languages';
import type { UserLocation } from '../locations/types';
import type { ConsentRecord, Gender, UserProfile } from '../models/user';

/**
 * Uygulamanın kullandığı veri hizmetleri. Ekranlar yalnızca bu arayüzleri bilir; Firebase
 * uygulaması src/firebase altındadır. Başka bir altyapıya geçilirse yalnızca o klasör değişir.
 */

export interface AuthUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
}

export type AuthErrorCode =
  | 'email-in-use'
  | 'invalid-email'
  | 'weak-password'
  | 'wrong-credentials'
  | 'too-many-requests'
  | 'network'
  | 'requires-recent-login'
  | 'popup-closed'
  | 'unknown';

export class AuthError extends Error {
  constructor(public readonly code: AuthErrorCode, cause?: unknown) {
    super(code);
    this.name = 'AuthError';
    if (cause) (this as { cause?: unknown }).cause = cause;
  }
}

export interface AuthService {
  currentUser(): AuthUser | null;
  /** Oturum değişince çağrılır; abonelikten çıkmak için dönen işlevi çağırın. */
  onChange(listener: (user: AuthUser | null) => void): () => void;
  signUp(email: string, password: string, displayName: string): Promise<AuthUser>;
  signIn(email: string, password: string): Promise<AuthUser>;
  /** Yalnızca web'de (panel ve web sürümü); mobilde yerel Google girişi geliştirme derlemesiyle gelecek. */
  signInWithGoogle(): Promise<AuthUser>;
  sendPasswordReset(email: string): Promise<void>;
  sendEmailVerification(): Promise<void>;
  /** E-posta doğrulandı mı diye sunucudan tazeler. */
  reload(): Promise<AuthUser | null>;
  signOut(): Promise<void>;
  /** Hesabı siler. Uzun süredir giriş yapılmadıysa şifre ister (requires-recent-login). */
  deleteAccount(password?: string): Promise<void>;
}

/** Kayıt sonrası oluşturulan profil (sunucu zaman damgaları depoda eklenir). */
export interface NewProfileInput {
  uid: string;
  displayName: string;
  language: LanguageCode;
  birthYear: number;
  consents: UserProfile['consents'] & object;
}

export interface ProfilePatch {
  displayName?: string;
  language?: LanguageCode;
  /** null konumu kaldırır. */
  location?: UserLocation | null;
  gender?: Gender;
  occupationId?: string;
  interests?: string[];
  isPrivate?: boolean;
  targeting?: ConsentRecord;
  commercialMessages?: ConsentRecord;
}

export interface ProfileRepository {
  get(uid: string): Promise<UserProfile | null>;
  create(input: NewProfileInput): Promise<void>;
  update(uid: string, patch: ProfilePatch, current: UserProfile): Promise<void>;
  delete(uid: string): Promise<void>;
}

export interface Occupation {
  id: string;
  names: { tr: string } & Partial<Record<LanguageCode, string>>;
  order: number;
  active: boolean;
}

export interface OccupationRepository {
  /** Etkin meslekler, sıralı. Liste boşsa ya da okunamazsa varsayılan liste döner. */
  listActive(): Promise<Occupation[]>;
}
