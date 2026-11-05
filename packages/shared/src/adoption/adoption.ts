/**
 * Hayvan sahiplendirme (Benim Şehrim > Gönüllülük; Karar Eren 5 Kasım 2026): ilanı yalnızca belediye barınakları ve
 * admin'in açtığı doğrulanmış dernekler verir (panelde "Hayvan sahiplendirme" bölümü). Sahiplendirme ücretsizdir; satış
 * ilanı yoktur. Uygulamada ilan sahibinin telefonu / e-postası gösterilir, iletişim doğrudan barınak / dernekledir.
 */

import type { AnnouncementRegion } from '../announcements/announcements';

export const ADOPTION_SPECIES = ['kedi', 'kopek', 'diger'] as const;
export type AdoptionSpecies = (typeof ADOPTION_SPECIES)[number];
export type AdoptionStatus = 'yayinda' | 'sahiplendirildi' | 'kaldirildi';

export interface AdoptionInput {
  name: string;
  species: AdoptionSpecies;
  /** "2 yaşında", "6 aylık" gibi. */
  age: string;
  sex: 'disi' | 'erkek' | 'bilinmiyor';
  breed?: string;
  vaccinated: boolean;
  neutered: boolean;
  about: string;
  /** Acil yuva arayan (hasta, yaşlı, barınak dolu). */
  urgent: boolean;
  /** İlçe / mahalle (yayınlayanın bölgesi içinde). */
  region: AnnouncementRegion;
  /** En az biri: barınağın / derneğin telefonu ya da e-postası. */
  phone?: string;
  email?: string;
}

export interface Adoption extends AdoptionInput {
  id: string;
  /** Yayınlayan: belediye (barınak) ya da dernek. */
  org: { id: string; name: string };
  status: AdoptionStatus;
  createdAt: string;
  updatedAt: string;
}

export const ADOPTION_LIMITS = { name: [1, 40], age: [1, 30], breed: 40, about: [10, 600], phone: 20, email: 120 } as const;

export type AdoptionError = 'name' | 'age' | 'about' | 'contact' | 'breed';

export function validateAdoption(a: AdoptionInput): AdoptionError[] {
  const errs: AdoptionError[] = [];
  const len = (s?: string) => (s ?? '').trim().length;
  if (len(a.name) < ADOPTION_LIMITS.name[0] || len(a.name) > ADOPTION_LIMITS.name[1]) errs.push('name');
  if (len(a.age) < ADOPTION_LIMITS.age[0] || len(a.age) > ADOPTION_LIMITS.age[1]) errs.push('age');
  if (len(a.breed) > ADOPTION_LIMITS.breed) errs.push('breed');
  if (len(a.about) < ADOPTION_LIMITS.about[0] || len(a.about) > ADOPTION_LIMITS.about[1]) errs.push('about');
  const phoneOk = !a.phone || /^\+?[0-9 ()-]{7,20}$/.test(a.phone.trim());
  const emailOk = !a.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim());
  if ((!len(a.phone) && !len(a.email)) || !phoneOk || !emailOk) errs.push('contact');
  return errs;
}

/** Uygulamada liste: acil olanlar önce, sonra en yeni. */
export function sortAdoptions(list: readonly Adoption[]): Adoption[] {
  return [...list].sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.createdAt.localeCompare(a.createdAt));
}
