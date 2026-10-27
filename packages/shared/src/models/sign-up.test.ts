import { describe, expect, it } from 'vitest';

import { validateSignUp, type SignUpInput } from '../index';

const valid: SignUpInput = {
  fullName: 'Eren Deneme',
  email: 'eren@example.com',
  password: 'gizli-sifre',
  passwordRepeat: 'gizli-sifre',
  birthYear: '1990',
  acceptTerms: true,
  readPrivacy: true,
};
const now = new Date('2026-10-27');

describe('kayıt formu', () => {
  it('geçerli form hata vermez', () => {
    expect(validateSignUp(valid, now)).toEqual({});
  });

  it('şifre en az 8 karakter ve iki kez aynı', () => {
    expect(validateSignUp({ ...valid, password: '1234567', passwordRepeat: '1234567' }, now).password).toBe('errors.passwordTooShort');
    expect(validateSignUp({ ...valid, passwordRepeat: 'baska-sifre' }, now).passwordRepeat).toBe('errors.passwordsDontMatch');
  });

  it('13 yaş altı ve geçersiz yıl reddedilir', () => {
    expect(validateSignUp({ ...valid, birthYear: '2015' }, now).birthYear).toBe('errors.tooYoung');
    expect(validateSignUp({ ...valid, birthYear: '2013' }, now).birthYear).toBeUndefined();
    expect(validateSignUp({ ...valid, birthYear: '19x0' }, now).birthYear).toBe('errors.invalidBirthYear');
    expect(validateSignUp({ ...valid, birthYear: '' }, now).birthYear).toBe('errors.required');
  });

  it('e-posta ve iki onay zorunlu', () => {
    expect(validateSignUp({ ...valid, email: 'eren@' }, now).email).toBe('errors.invalidEmail');
    expect(validateSignUp({ ...valid, readPrivacy: false }, now).acceptTerms).toBe('errors.mustAccept');
  });
});
