import type { KeyValueCache } from '../locations/repository';
import type { District, Province } from '../locations/types';
import { normalizeName } from '../organizations/municipalities';
import { citySection, STRUCTURAL_KEYS, type CityGuideColumn, type CityGuideSectionId } from './schema';

/** Ülke geneli içerik (il seçilmeden, örn. "Nasıl yapılır?" rehberi) bu anahtarla saklanır. */
export const NATIONAL = 'tr';

export type CityValue = string | number | boolean | string[];

/** Bir yer ya da bilgi kartı (müze, otopark, belediye hizmeti...). İçerik Türkçe girilir. */
export interface CityGuideItem {
  /** Bölüm + ilçe (ya da il) + ad'dan üretilir; aynı yer yeniden yüklenince kimlik değişmez. */
  id: string;
  section: CityGuideSectionId;
  /** Plaka kodu ya da ülke geneli için NATIONAL. */
  provinceCode: string;
  districtId?: string;
  name: string;
  /** Kategori / tür / tip sütunu. */
  category?: string;
  values: Record<string, CityValue>;
  location?: { lat: number; lng: number };
  /** Bilginin alındığı adres ve bakıldığı gün (yyyy-aa-gg). */
  source: string;
  sourceDate: string;
  /** İl yöneticisi, belediye ya da CityJoy ekibi doğrulayınca true. Yüklemede false gelir. */
  verified: boolean;
  /** Doğrulama tarihi (yyyy-aa-gg). */
  verifiedAt?: string;
}

export interface ImportError {
  sheet: string;
  /** Excel'deki satır numarası (başlık 1. satır). 0 = sekmenin tamamı. */
  row: number;
  message: string;
}

export interface ParseContext {
  provinces: readonly Province[];
  districts: readonly District[];
  /** Kaynak tarihi bugünden ileri olamaz. */
  today?: Date;
}

const slug = (s: string) => normalizeName(s).replace(/ /g, '-').slice(0, 80);

export function cityItemId(section: CityGuideSectionId, place: string, name: string): string {
  return `${section}--${place}--${slug(name)}`;
}

function text(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = text(v).replace(/\s/g, '').replace(',', '.');
  if (!t || !/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

function toBool(v: unknown): boolean | null {
  const t = normalizeName(text(v));
  if (['evet', 'yes', 'var', 'e', 'true', '1'].includes(t)) return true;
  if (['hayir', 'no', 'yok', 'h', 'false', '0'].includes(t)) return false;
  return null;
}

/** GG.AA.YYYY, YYYY-AA-GG ya da Excel tarih hücresi -> yyyy-aa-gg. */
function toDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const t = text(v);
  let m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? t : null;
}

function toPhone(v: unknown): string | null {
  let d = text(v).replace(/\D/g, '');
  if (d.startsWith('90') && d.length === 12) d = `0${d.slice(2)}`;
  return d.length >= 3 && d.length <= 13 ? d : null;
}

const isUrl = (t: string) => /^https?:\/\/[^\s.]+\.[^\s]{2,}$/.test(t) && !t.includes('...');

const MAX_LONG = 600;
const MAX_SHORT = 200;
const LONG_KEYS = ['aciklama', 'kisa_metin', 'adimlar', 'gerekli_evrak', 'gerekli_belgeler'];

/**
 * Bir Excel sekmesinin satırlarını denetler ve öğeye çevirir (panelde "Excel'den yükle"). Hatalı satır öğe olmaz,
 * hata listesine yazılır; gri örnek satırlar atlanır. Aynı dosyada aynı yer iki kez varsa ikincisi hatadır.
 */
export function parseCitySheet(
  sectionId: CityGuideSectionId,
  rows: readonly (readonly unknown[])[],
  ctx: ParseContext,
): { items: CityGuideItem[]; errors: ImportError[]; skipped: number } {
  const section = citySection(sectionId)!;
  const sheet = section.sheet;
  const errors: ImportError[] = [];
  const items: CityGuideItem[] = [];
  let skipped = 0;
  const header = (rows[0] ?? []).map((h) => text(h));
  const missing = section.columns.filter((c) => !header.includes(c.key)).map((c) => c.key);
  if (missing.length) {
    errors.push({ sheet, row: 0, message: `Eksik sütun: ${missing.join(', ')}. Şablondaki sütun adlarını değiştirmeyin.` });
    return { items, errors, skipped };
  }
  const index = Object.fromEntries(header.map((h, i) => [h, i]));
  const today = (ctx.today ?? new Date()).toISOString().slice(0, 10);
  const byProvinceName = new Map(ctx.provinces.map((p) => [normalizeName(p.name), p]));
  const seen = new Set<string>();

  rows.slice(1).forEach((raw, i) => {
    const rowNo = i + 2;
    const cell = (key: string) => raw[index[key]!];
    if (section.columns.every((c) => text(cell(c.key)) === '')) return;
    if (/ÖRNEK SATIR/i.test(text(cell('not')))) {
      skipped += 1;
      return;
    }
    const problems: string[] = [];
    const values: Record<string, CityValue> = {};
    let lat: number | null = null;
    let lng: number | null = null;
    let source = '';
    let sourceDate = '';

    for (const col of section.columns) {
      const v = cell(col.key);
      const t = text(v);
      if (!t) {
        if (col.required) problems.push(`"${col.key}" boş olamaz`);
        continue;
      }
      const err = (m: string) => problems.push(`"${col.key}": ${m}`);
      switch (col.type) {
        case 'choice':
          if (!col.choices!.includes(t)) err(`"${t}" listede yok`);
          else values[col.key] = t;
          break;
        case 'bool': {
          const b = toBool(v);
          if (b === null) err('Evet ya da Hayır yazın');
          else values[col.key] = b;
          break;
        }
        case 'number': {
          const n = toNumber(v);
          if (n === null || n < 0) err('sayı olmalı');
          else values[col.key] = n;
          break;
        }
        case 'lat':
        case 'lng': {
          const n = toNumber(v);
          const ok = n !== null && (col.type === 'lat' ? n >= 35 && n <= 43 : n >= 25 && n <= 45);
          if (!ok) err('Türkiye sınırları içinde ondalık derece olmalı (örnek 40.1885)');
          else if (col.type === 'lat') lat = n;
          else lng = n;
          break;
        }
        case 'url':
          if (!isUrl(t)) err('tam adres olmalı (https://...)');
          else if (col.key === 'kaynak') source = t;
          else values[col.key] = t;
          break;
        case 'date': {
          const d = toDate(v);
          if (!d) err('GG.AA.YYYY biçiminde olmalı');
          else if (d > today) err('ileri bir tarih olamaz');
          else sourceDate = d;
          break;
        }
        case 'phone': {
          const p = toPhone(v);
          if (!p) err('yalnızca rakam, 3-13 hane');
          else values[col.key] = p;
          break;
        }
        case 'list':
          values[col.key] = t.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 20);
          break;
        case 'steps':
          values[col.key] = t.split('|').map((x) => x.trim()).filter(Boolean).slice(0, 20);
          break;
        default:
          if (t.length > (LONG_KEYS.includes(col.key) ? MAX_LONG : MAX_SHORT)) err('çok uzun');
          else values[col.key] = t;
      }
    }

    // İl ve ilçe: konum listesindeki yazımla eşleşmeli.
    let provinceCode = NATIONAL;
    let districtId: string | undefined;
    const ilText = text(cell('il'));
    if (ilText) {
      const p = byProvinceName.get(normalizeName(ilText));
      if (!p) problems.push(`"il": "${ilText}" bulunamadı`);
      else provinceCode = p.code;
    }
    if (index.ilce !== undefined && provinceCode !== NATIONAL) {
      const ilceText = text(cell('ilce'));
      if (ilceText) {
        const d = ctx.districts.find((x) => x.provinceCode === provinceCode && normalizeName(x.name) === normalizeName(ilceText));
        if (!d) problems.push(`"ilce": "${ilceText}" bu ilde yok`);
        else districtId = d.id;
      }
    }
    if ((lat === null) !== (lng === null)) problems.push('enlem ve boylam birlikte yazılmalı');

    const nameKey = ['ad', 'hizmet_adi', 'baslik'].find((k) => typeof values[k] === 'string');
    const name =
      sectionId === 'muhtarliklar' ? `${text(cell('mahalle'))} Muhtarlığı` : nameKey ? String(values[nameKey]) : '';
    if (!name.trim()) problems.push('ad bulunamadı');
    const categoryKey = ['kategori', 'tur', 'tip'].find((k) => typeof values[k] === 'string');

    if (problems.length) {
      errors.push({ sheet, row: rowNo, message: problems.join('; ') });
      return;
    }
    // Belediye hizmetinde aynı ad birçok belediyede olur; kimliğe belediye de girer.
    const place = sectionId === 'belediye-hizmetleri' ? `${provinceCode}-${slug(text(cell('belediye')))}` : (districtId ?? provinceCode);
    const id = cityItemId(sectionId, place, name);
    if (seen.has(id)) {
      errors.push({ sheet, row: rowNo, message: `Aynı yer bu dosyada iki kez var: ${name}` });
      return;
    }
    seen.add(id);
    for (const k of STRUCTURAL_KEYS) delete values[k];
    items.push({
      id,
      section: sectionId,
      provinceCode,
      ...(districtId ? { districtId } : {}),
      name: name.trim(),
      ...(categoryKey ? { category: String(values[categoryKey]) } : {}),
      values,
      ...(lat !== null && lng !== null ? { location: { lat, lng } } : {}),
      source,
      sourceDate,
      verified: false,
    });
  });
  return { items, errors, skipped };
}

const contentOf = (i: CityGuideItem) => JSON.stringify([i.name, i.category, i.districtId, i.values, i.location, i.source]);

/**
 * Yüklenen öğeleri var olanlarla birleştirir: aynı kimlik güncellenir (içerik değiştiyse doğrulama düşer),
 * yeni olan eklenir, dosyada olmayan eski öğeler kalır (silmek panelden tek tek yapılır).
 */
export function mergeCityItems(existing: readonly CityGuideItem[], incoming: readonly CityGuideItem[]) {
  const map = new Map(existing.map((i) => [i.id, i]));
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  for (const item of incoming) {
    const old = map.get(item.id);
    if (!old) {
      added += 1;
      map.set(item.id, item);
    } else if (contentOf(old) === contentOf(item)) {
      unchanged += 1;
      // Yalnızca kaynak tarihi yenilenir; doğrulama korunur.
      map.set(item.id, { ...old, sourceDate: item.sourceDate });
    } else {
      updated += 1;
      map.set(item.id, item);
    }
  }
  const items = [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  return { items, added, updated, unchanged };
}

export function columnsOf(sectionId: CityGuideSectionId): CityGuideColumn[] {
  return citySection(sectionId)?.columns ?? [];
}

// ---- Uygulama: il başına bölüm paketleri, telefonda saklanır (maliyet ilkesi, PROJE.md 9.1) ----

/** İlin bölüm özeti: uygulama açılışta yalnızca bunu okur (tek okuma). */
export interface CityGuideMeta {
  sections: Partial<Record<CityGuideSectionId, { version: string; count: number; parts: number }>>;
}

export interface CityGuideRepository {
  meta(provinceCode: string): Promise<CityGuideMeta | null>;
  items(provinceCode: string, section: CityGuideSectionId, parts: number): Promise<CityGuideItem[]>;
}

export function createCityGuideStore(repo: CityGuideRepository, cache: KeyValueCache) {
  const metaKey = (p: string) => `cityGuide.meta.${p}`;
  const itemsKey = (p: string, s: string) => `cityGuide.items.${p}.${s}`;
  const versionKey = (p: string, s: string) => `cityGuide.version.${p}.${s}`;
  const read = async <T>(key: string): Promise<T | null> => {
    try {
      const raw = await cache.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  };
  return {
    /** Telefonda saklı özet (internetsiz açılış için). */
    cachedMeta: (provinceCode: string) => read<CityGuideMeta>(metaKey(provinceCode)),
    /** Özeti sunucudan tazeler (tek okuma). Ulaşılamazsa hata verir; ekran saklı olanı gösterir. */
    async refreshMeta(provinceCode: string): Promise<CityGuideMeta> {
      const meta = (await repo.meta(provinceCode)) ?? { sections: {} };
      await cache.set(metaKey(provinceCode), JSON.stringify(meta));
      return meta;
    },
    cachedItems: async (provinceCode: string, section: CityGuideSectionId) =>
      (await read<CityGuideItem[]>(itemsKey(provinceCode, section))) ?? [],
    /** Bölüm değiştiyse indirir, değişmediyse telefondakini verir. */
    async items(provinceCode: string, section: CityGuideSectionId, meta: CityGuideMeta): Promise<CityGuideItem[]> {
      const info = meta.sections[section];
      if (!info || info.count === 0) return [];
      const cached = await read<CityGuideItem[]>(itemsKey(provinceCode, section));
      if (cached && (await cache.get(versionKey(provinceCode, section))) === info.version) return cached;
      const list = await repo.items(provinceCode, section, info.parts);
      await cache.set(itemsKey(provinceCode, section), JSON.stringify(list));
      await cache.set(versionKey(provinceCode, section), info.version);
      return list;
    },
  };
}

/** Öğeyi Excel satırı biçimine geri çevirir (panelde düzenleme formu ve dışa aktarma için). */
export function cityItemToRow(item: CityGuideItem, ctx: Pick<ParseContext, 'provinces' | 'districts'>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const col of columnsOf(item.section)) {
    const v = item.values[col.key];
    if (v === undefined) continue;
    out[col.key] =
      typeof v === 'boolean' ? (v ? 'Evet' : 'Hayır') : Array.isArray(v) ? v.join(col.type === 'steps' ? ' | ' : ', ') : String(v);
  }
  if (item.provinceCode !== NATIONAL) out.il = ctx.provinces.find((p) => p.code === item.provinceCode)?.name ?? '';
  if (item.districtId) out.ilce = ctx.districts.find((d) => d.id === item.districtId)?.name ?? '';
  if (item.location) {
    out.enlem = String(item.location.lat);
    out.boylam = String(item.location.lng);
  }
  out.kaynak = item.source;
  const [y, m, d] = item.sourceDate.split('-');
  out.kaynak_tarihi = `${d}.${m}.${y}`;
  return out;
}
