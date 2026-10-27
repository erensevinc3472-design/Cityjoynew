import { AuthError, type AuthErrorCode } from '@cityjoy/shared';

const KEYS: Record<AuthErrorCode, string> = {
  'email-in-use': 'errors.emailInUse',
  'invalid-email': 'errors.invalidEmail',
  'weak-password': 'errors.weakPassword',
  'wrong-credentials': 'errors.wrongCredentials',
  'too-many-requests': 'errors.tooManyRequests',
  network: 'errors.network',
  'requires-recent-login': 'errors.requiresRecentLogin',
  'popup-closed': 'errors.unknown',
  unknown: 'errors.unknown',
};

/** Hatayı kullanıcıya gösterilecek metnin anahtarına çevirir. */
export function errorKey(e: unknown): string {
  return e instanceof AuthError ? KEYS[e.code] : 'errors.unknown';
}

