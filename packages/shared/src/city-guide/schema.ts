import schema from '../../data/city-guide-schema.json';
import type { LanguageCode } from '../i18n/languages';

/**
 * Benim Şehrim sabit bilgi bölümleri (müzeler, otoparklar, pazarlar...). Tanımlar tek kaynaktan gelir:
 * `data/city-guide-schema.json`. Excel şablonu, panel yükleyicisi ve uygulama ekranları aynı dosyayı kullanır.
 */
export type CityGuideSectionId =
  | 'onemli-kurumlar'
  | 'muzeler'
  | 'otoparklar'
  | 'parklar'
  | 'pazarlar'
  | 'ulasim'
  | 'toplanma-alanlari'
  | 'muhtarliklar'
  | 'belediye-hizmetleri'
  | 'nasil-yapilir';

export type ColumnType = 'text' | 'number' | 'choice' | 'bool' | 'list' | 'steps' | 'url' | 'date' | 'phone' | 'lat' | 'lng';

export interface CityGuideColumn {
  key: string;
  required: boolean;
  type: ColumnType;
  /** Excel'de başlık açıklaması (Türkçe). */
  hint: string;
  choices?: string[];
}

export interface CityGuideSection {
  id: CityGuideSectionId;
  /** Excel sekme adı. */
  sheet: string;
  /** Material simge adı. */
  icon: string;
  names: Record<LanguageCode, string>;
  description: string;
  columns: CityGuideColumn[];
}

type Localized = Record<LanguageCode, string>;

export const CITY_GUIDE_SECTIONS = schema.sections as unknown as CityGuideSection[];
const LABELS = schema.labels as Record<string, Localized>;
const CHOICES = schema.choices as Record<string, Localized>;

export function citySection(id: string): CityGuideSection | undefined {
  return CITY_GUIDE_SECTIONS.find((s) => s.id === id);
}

/** Sütunun görünen adı (uygulama ve panel). */
export function cityFieldLabel(key: string, lang: LanguageCode): string {
  const l = LABELS[key];
  return l?.[lang] ?? l?.tr ?? key;
}

/** Seçenek kodunun görünen adı ("hastane-devlet" -> "Devlet hastanesi"). */
export function cityChoiceLabel(code: string, lang: LanguageCode): string {
  const c = CHOICES[code];
  return c?.[lang] ?? c?.tr ?? code;
}

/** Konum ve kaynak sütunları öğenin kendi alanlarına gider; geri kalanı "values" içinde durur. */
export const STRUCTURAL_KEYS = ['il', 'ilce', 'kaynak', 'kaynak_tarihi', 'enlem', 'boylam'] as const;
/** Panelde görünen, uygulamada gösterilmeyen iç not. */
export const INTERNAL_KEYS = ['not'] as const;
