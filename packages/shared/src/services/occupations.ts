import defaults from '../../data/occupations.json';
import type { LanguageCode } from '../i18n/languages';
import type { Occupation } from './types';

/** Admin henüz liste girmediyse kullanılan başlangıç listesi; panelden veritabanına yüklenebilir. */
export const DEFAULT_OCCUPATIONS: Occupation[] = (defaults as Omit<Occupation, 'order' | 'active'>[]).map((o, i) => ({
  ...o,
  order: i + 1,
  active: true,
}));

export function occupationName(o: Occupation, language: LanguageCode): string {
  return o.names[language] ?? o.names.tr;
}
