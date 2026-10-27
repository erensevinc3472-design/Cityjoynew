import type { LanguageCode } from '../i18n/languages';
import type { UserLocation } from '../locations/types';

export type Gender = 'kadin' | 'erkek' | 'belirtmek-istemiyorum';

/** Onaylar ayrı ayrı ve tarihli tutulur (KVKK: her rıza ayrı, geri alınabilir). */
export interface ConsentRecord {
  granted: boolean;
  /** ISO tarih. */
  at: string;
  /** Onaylanan metnin sürümü. */
  textVersion: string;
}

export interface UserConsents {
  /** Kullanım şartları (zorunlu). */
  terms: ConsentRecord;
  /** Aydınlatma metni okundu bilgisi (zorunlu). */
  privacyNotice: ConsentRecord;
  /** Yaş, cinsiyet, ilgi alanı ve meslekle hedefli bildirim (isteğe bağlı açık rıza). */
  targeting?: ConsentRecord;
  /** Ticari elektronik ileti / kampanya bildirimi (isteğe bağlı). */
  commercialMessages?: ConsentRecord;
}

/**
 * Kullanıcı profili. Yaş, cinsiyet, meslek ve mahalle diğer kullanıcılara gösterilmez;
 * yalnızca bildirim hedefleme ve içerik filtreleme için sunucuda kullanılır.
 */
export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  language: LanguageCode;
  /** Kayıtta zorunlu değil; Benim Şehrim'e girerken il ve ilçe istenir. */
  location?: UserLocation;
  /** Mahalle en son ne zaman değişti (ayda bir kez kuralı). */
  locationChangedAt?: string;
  birthYear?: number;
  gender?: Gender;
  /** Admin'in yönettiği meslek listesinden seçilir (zorunlu; "Belirtmek istemiyorum" seçeneği var). */
  occupationId?: string;
  interests?: string[];
  phoneVerified: boolean;
  emailVerified: boolean;
  isPrivate: boolean;
  consents?: UserConsents;
  createdAt: string;
}

export const MIN_REGISTRATION_AGE = 13;
export const ADULT_AGE = 18;

/** Doğum yılına göre yaş grubu. 13-17 kısıtlı mod, 13 altı kayıt yok. */
export function ageGroup(birthYear: number, now = new Date()): 'cocuk' | 'genc' | 'yetiskin' {
  const age = now.getFullYear() - birthYear;
  if (age < MIN_REGISTRATION_AGE) return 'cocuk';
  if (age < ADULT_AGE) return 'genc';
  return 'yetiskin';
}
