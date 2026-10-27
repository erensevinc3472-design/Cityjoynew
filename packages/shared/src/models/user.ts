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
  displayName: string;
  language: LanguageCode;
  /** Kayıtta zorunlu değil; Benim Şehrim'e girerken il ve ilçe istenir. */
  location?: UserLocation;
  /** Mahalle en son ne zaman değişti (ayda bir kez kuralı), ISO tarih. */
  locationChangedAt?: string;
  /** Yaş kilidi: kayıttan sonra değiştirilemez. */
  birthYear: number;
  gender?: Gender;
  /** Admin'in yönettiği meslek listesinden seçilir (zorunlu; "Belirtmek istemiyorum" seçeneği var). */
  occupationId?: string;
  interests?: string[];
  phoneVerified: boolean;
  emailVerified: boolean;
  isPrivate: boolean;
  consents: UserConsents;
  createdAt: string;
}

/** Kullanıcı bölümü tamamlamalı: meslek zorunlu (PROJE.md 3.1 madde 8). */
export function isProfileComplete(p: Pick<UserProfile, 'occupationId'>): boolean {
  return !!p.occupationId;
}

/** Mahalle ayda bir kez değiştirilebilir (Keşfet kuralı 5); ilk seçim serbesttir. */
export const NEIGHBOURHOOD_CHANGE_DAYS = 30;

export function nextNeighbourhoodChange(p: Pick<UserProfile, 'location' | 'locationChangedAt'>): Date | null {
  if (!p.location?.neighbourhoodId || !p.locationChangedAt) return null;
  const next = new Date(p.locationChangedAt);
  next.setDate(next.getDate() + NEIGHBOURHOOD_CHANGE_DAYS);
  return next;
}

/** Şifre kuralı: en az 8 karakter (PROJE.md 3.1 madde 5). */
export const MIN_PASSWORD_LENGTH = 8;

/** Yasal metinlerin sürümü; metin değişince yeniden onay istenir. Avukat onayı bekleniyor. */
export const LEGAL_TEXT_VERSION = 'taslak-2026-10';

export const MIN_REGISTRATION_AGE = 13;
export const ADULT_AGE = 18;

/** Doğum yılına göre yaş grubu. 13-17 kısıtlı mod, 13 altı kayıt yok. */
export function ageGroup(birthYear: number, now = new Date()): 'cocuk' | 'genc' | 'yetiskin' {
  const age = now.getFullYear() - birthYear;
  if (age < MIN_REGISTRATION_AGE) return 'cocuk';
  if (age < ADULT_AGE) return 'genc';
  return 'yetiskin';
}
