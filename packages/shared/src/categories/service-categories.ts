import defaults from '../../data/service-categories.json';
import { localized, type LocalizedText } from '../emergency/numbers';
import type { LanguageCode } from '../i18n/languages';
import type { KeyValueCache } from '../locations/repository';
import { foldForSearch } from '../locations/search';

/**
 * Hizmet kategorisi (PROJE.md 5.4): iki seviyeli ağaç, ana kategori > alt kategori. Admin yönetir.
 * İşletmem'den eklenen işletmeler alt kategoriye bağlanır ve Acil İhtiyaçlar'da bu ağaçla listelenir.
 */
export interface ServiceCategory {
  id: string;
  /** Ana kategoride null; alt kategoride ana kategorinin kimliği. */
  parentId: string | null;
  names: LocalizedText;
  /** Uygulamadaki Material simge adı. */
  icon: string;
  order: number;
  active: boolean;
  /** Acil kategori (çilingir, çekici...): dolandırıcılık riskine karşı doğrulama aranır (PROJE.md 5.6). */
  urgent?: boolean;
}

export interface CategoryNode {
  category: ServiceCategory;
  children: ServiceCategory[];
}

type DefaultMain = { id: string; icon: string; names: LocalizedText; children: { id: string; icon: string; names: LocalizedText; urgent?: boolean }[] };

/** Veritabanı boşken kullanılan başlangıç listesi (tasarımdaki kategoriler). */
export const DEFAULT_SERVICE_CATEGORIES: ServiceCategory[] = (defaults as DefaultMain[]).flatMap((m, i) => [
  { id: m.id, parentId: null, names: m.names, icon: m.icon, order: i + 1, active: true },
  ...m.children.map((c, j) => ({
    id: c.id,
    parentId: m.id,
    names: c.names,
    icon: c.icon,
    order: j + 1,
    active: true,
    ...(c.urgent ? { urgent: true } : {}),
  })),
]);

/** Panelde seçilebilen simgeler: başlangıç listesindekiler ve birkaç genel simge. */
export const SERVICE_ICONS: string[] = [...new Set([...DEFAULT_SERVICE_CATEGORIES.map((c) => c.icon), 'category', 'star', 'storefront'])].sort();

const byOrder = (a: ServiceCategory, b: ServiceCategory) => a.order - b.order;

/**
 * Etkin kategorilerden ağaç kurar. Pasif ana kategorinin alt kategorileri de gizlenir; etkin alt
 * kategorisi olmayan ana kategori gösterilmez. Veritabanı boşsa başlangıç listesi kullanılır.
 */
export function buildCategoryTree(all: readonly ServiceCategory[]): CategoryNode[] {
  const list = all.length ? all : DEFAULT_SERVICE_CATEGORIES;
  return list
    .filter((c) => c.parentId === null && c.active)
    .sort(byOrder)
    .map((category) => ({ category, children: list.filter((c) => c.parentId === category.id && c.active).sort(byOrder) }))
    .filter((n) => n.children.length > 0);
}

/**
 * Aramada Türkçe karakter farkı yok sayılır; seçili dil ve Türkçe adlarda aranır.
 * Ana kategori eşleşirse tüm alt kategorileri, yoksa yalnızca eşleşen alt kategoriler kalır.
 */
export function searchCategoryTree(tree: readonly CategoryNode[], query: string, language: LanguageCode): CategoryNode[] {
  const q = foldForSearch(query);
  if (!q) return [...tree];
  const matches = (c: ServiceCategory) =>
    [localized(c.names, language), c.names.tr].some((n) => !!n && foldForSearch(n).includes(q));
  return tree
    .map((n) => (matches(n.category) ? n : { ...n, children: n.children.filter(matches) }))
    .filter((n) => n.children.length > 0);
}

export function findCategory(all: readonly ServiceCategory[], id: string): ServiceCategory | undefined {
  return (all.length ? all : DEFAULT_SERVICE_CATEGORIES).find((c) => c.id === id);
}

export interface ServiceCategoryRepository {
  /** Liste her değiştiğinde değişen sürüm damgası; hiç değişiklik yapılmadıysa null. Tek okuma. */
  version(): Promise<string | null>;
  /** Tüm kategoriler (pasifler dahil). */
  listAll(): Promise<ServiceCategory[]>;
}

const LIST_KEY = 'service-categories:list:v1';
const VERSION_KEY = 'service-categories:version:v1';

/**
 * Maliyet ilkesi (PROJE.md 9.1): liste telefonda saklanır. Her açılışta yalnızca sürüm damgası
 * okunur (tek okuma); liste yalnızca damga değişince yeniden indirilir.
 */
export function createServiceCategoryStore(repo: ServiceCategoryRepository, cache: KeyValueCache) {
  const readCached = async (): Promise<ServiceCategory[] | null> => {
    try {
      const raw = await cache.get(LIST_KEY);
      const list = raw ? (JSON.parse(raw) as ServiceCategory[]) : null;
      return Array.isArray(list) ? list : null;
    } catch {
      return null;
    }
  };
  return {
    /** Telefonda saklı liste; yoksa boş (ağaç başlangıç listesini kullanır). */
    async cached(): Promise<ServiceCategory[]> {
      return (await readCached()) ?? [];
    },
    /** Ulaşılamazsa hata verir; ekran saklı listeyi göstermeye devam eder. */
    async refresh(): Promise<ServiceCategory[]> {
      const version = await repo.version();
      // Hiç değişiklik yapılmadıysa veritabanı boştur: başlangıç listesi geçerli, indirme yok.
      if (version === null) return [];
      const cached = await readCached();
      if (cached && (await cache.get(VERSION_KEY)) === version) return cached;
      const list = await repo.listAll();
      await cache.set(LIST_KEY, JSON.stringify(list));
      await cache.set(VERSION_KEY, version);
      return list;
    },
  };
}

/** "Eksik hizmet mi var? Bildir" (PROJE.md 5.4): kullanıcının önerisi, panelde incelenir. */
export interface ServiceSuggestion {
  id: string;
  uid: string;
  text: string;
  provinceCode?: string;
  /** ISO tarih. */
  createdAt: string;
  status: 'yeni' | 'incelendi';
}

export const SUGGESTION_MIN = 3;
export const SUGGESTION_MAX = 300;

export function isValidSuggestion(text: string): boolean {
  const t = text.trim();
  return t.length >= SUGGESTION_MIN && t.length <= SUGGESTION_MAX;
}
