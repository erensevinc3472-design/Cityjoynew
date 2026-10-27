import defaults from '../../data/emergency-numbers.json';
import type { LanguageCode } from '../i18n/languages';
import type { KeyValueCache } from '../locations/repository';

/** Metin: Türkçe zorunlu, diğer diller isteğe bağlı (çeviri yoksa Türkçe gösterilir). */
export type LocalizedText = { tr: string } & Partial<Record<LanguageCode, string>>;

/**
 * Acil numara (PROJE.md 5.4). Ülke genelinde ortaktır; dokununca telefon aramasını açan düz bağlantıdır.
 * Uygulama hiçbir numarayı kendiliğinden aramaz.
 */
export interface EmergencyNumber {
  id: string;
  /** Yalnızca rakam (örn. "112"). */
  number: string;
  names: LocalizedText;
  /** Kısa açıklama (örn. "112'ye bağlanır"). */
  notes?: LocalizedText;
  icon: EmergencyIcon;
  order: number;
  active: boolean;
}

/** Panelde seçilebilen simgeler (uygulamadaki Material simge adları). */
export const EMERGENCY_ICONS = [
  'emergency',
  'local-police',
  'fire-truck',
  'security',
  'support-agent',
  'water-drop',
  'electric-bolt',
  'local-fire-department',
  'local-hospital',
  'forest',
  'directions-boat',
  'warning',
  'call',
] as const;
export type EmergencyIcon = (typeof EMERGENCY_ICONS)[number];

/** Veritabanı boşken ya da hiç ulaşılamazken gösterilen liste (uygulamaya gömülü, internetsiz çalışır). */
export const DEFAULT_EMERGENCY_NUMBERS: EmergencyNumber[] = (defaults as Omit<EmergencyNumber, 'order' | 'active'>[]).map(
  (n, i) => ({ ...n, order: i + 1, active: true }),
);

export function isValidPhoneNumber(number: string): boolean {
  return /^[0-9]{3,15}$/.test(number);
}

/** "0 (224) 444-12 34" gibi yazımı rakamlara indirir. */
export function normalizePhoneNumber(input: string): string {
  return input.replace(/\D/g, '');
}

export function localized(text: LocalizedText | undefined, language: LanguageCode): string | undefined {
  return text ? (text[language] ?? text.tr) : undefined;
}

/** Telefonun arama ekranını açan bağlantı. */
export function telUrl(number: string): string {
  return `tel:${normalizePhoneNumber(number)}`;
}

/** Etkin numaralar, sıralı. Veritabanında hiç kayıt yoksa başlangıç listesi kullanılır. */
export function activeEmergencyNumbers(all: readonly EmergencyNumber[]): EmergencyNumber[] {
  if (!all.length) return DEFAULT_EMERGENCY_NUMBERS;
  return all.filter((n) => n.active && isValidPhoneNumber(n.number)).sort((a, b) => a.order - b.order);
}

export interface EmergencyNumberRepository {
  /** Veritabanındaki tüm kayıtlar (pasifler dahil). Ulaşılamazsa hata verir. */
  listAll(): Promise<EmergencyNumber[]>;
}

const CACHE_KEY = 'emergency-numbers:v1';

/**
 * Acil numaralar önce telefondaki son listeden (yoksa gömülü listeden) hemen gösterilir, sonra
 * sunucudan tazelenir. İnternet yoksa ekran boş kalmaz.
 */
export function createEmergencyNumberStore(repo: EmergencyNumberRepository, cache: KeyValueCache) {
  return {
    async cached(): Promise<EmergencyNumber[]> {
      try {
        const raw = await cache.get(CACHE_KEY);
        const list = raw ? (JSON.parse(raw) as EmergencyNumber[]) : null;
        return Array.isArray(list) && list.length ? list : DEFAULT_EMERGENCY_NUMBERS;
      } catch {
        return DEFAULT_EMERGENCY_NUMBERS;
      }
    },
    /** Sunucudan tazeler ve saklar. Ulaşılamazsa hata verir; ekran saklı listeyi göstermeye devam eder. */
    async refresh(): Promise<EmergencyNumber[]> {
      const list = activeEmergencyNumbers(await repo.listAll());
      await cache.set(CACHE_KEY, JSON.stringify(list));
      return list;
    },
  };
}
