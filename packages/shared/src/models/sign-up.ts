import { ageGroup, MIN_PASSWORD_LENGTH } from './user';

export interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
  passwordRepeat: string;
  birthYear: string;
  acceptTerms: boolean;
  readPrivacy: boolean;
}

/** Alan -> hata metni anahtarı (errors.*). Boşsa form geçerlidir. */
export type SignUpErrors = Partial<Record<keyof SignUpInput, string>>;

export const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export function validateSignUp(input: SignUpInput, now = new Date()): SignUpErrors {
  const errors: SignUpErrors = {};
  if (input.fullName.trim().length < 2) errors.fullName = 'errors.required';
  if (!isValidEmail(input.email)) errors.email = input.email.trim() ? 'errors.invalidEmail' : 'errors.required';
  if (input.password.length < MIN_PASSWORD_LENGTH) errors.password = 'errors.passwordTooShort';
  else if (input.password !== input.passwordRepeat) errors.passwordRepeat = 'errors.passwordsDontMatch';

  const birthYear = birthYearError(input.birthYear, now);
  if (birthYear) errors.birthYear = birthYear;
  if (!input.acceptTerms || !input.readPrivacy) errors.acceptTerms = 'errors.mustAccept';
  return errors;
}

/** Doğum yılı hatası (errors.*) ya da undefined. 13 yaş altı kayıt kabul edilmez. */
export function birthYearError(value: string, now = new Date()): string | undefined {
  const text = value.trim();
  if (!text) return 'errors.required';
  const year = Number(text);
  if (!/^\d{4}$/.test(text) || year < now.getFullYear() - 120 || year > now.getFullYear()) return 'errors.invalidBirthYear';
  if (ageGroup(year, now) === 'cocuk') return 'errors.tooYoung';
  return undefined;
}
