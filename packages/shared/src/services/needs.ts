/**
 * Acil İhtiyaçlar > Diğer İhtiyaçlar (13. madde 35): durum kartları ilgili hizmet listelerine götürür. Hangi kartın
 * hangi hizmetleri açtığını admin panelden belirler (config/needs); belge yoksa buradaki varsayılan eşleşme kullanılır.
 */
export const NEED_SITUATIONS = ['yeni-tasindim', 'yogunum', 'tatil', 'hasta', 'yasli-yakin', 'ozel-gun'] as const;
export type NeedSituation = (typeof NEED_SITUATIONS)[number];

/** Bir kartta en çok bu kadar hizmet. */
export const NEED_MAX_SERVICES = 12;

export type NeedMap = Record<NeedSituation, string[]>;

export const DEFAULT_NEED_MAP: NeedMap = {
  'yeni-tasindim': ['evden-eve', 'cilingir', 'elektrikci', 'tesisatci', 'ev-temizligi', 'boya-badana', 'genel-usta'],
  yogunum: ['ev-temizligi', 'hali-yikama', 'damacana-su', 'manav', 'pet-bakici', 'koltuk-yikama'],
  tatil: ['pet-otel', 'pet-bakici', 'bahce-bakimi', 'havuz-bakimi', 'arac-kiralama', 'kamera-sistemleri'],
  hasta: ['evde-bakim', 'ozel-ambulans', 'fizik-tedavi', 'ev-temizligi', 'diyetisyen'],
  'yasli-yakin': ['evde-bakim', 'fizik-tedavi', 'ozel-ambulans', 'ev-temizligi', 'diyetisyen'],
  'ozel-gun': ['dugun', 'dogum-gunu', 'catering', 'fotografci', 'dj-ses', 'dekorasyon', 'pastane'],
};

/**
 * Sunucudan gelen eşleşmeyi temizler: bilinmeyen durum ve kategori atılır, her durum en çok NEED_MAX_SERVICES hizmet.
 * Admin bir durumu hiç girmediyse varsayılan kalır; boş liste girdiyse o kart gizlenir.
 */
export function resolveNeedMap(raw: unknown, knownIds: ReadonlySet<string>): NeedMap {
  const out = {} as NeedMap;
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  for (const s of NEED_SITUATIONS) {
    const list = Array.isArray(src[s]) ? (src[s] as unknown[]) : DEFAULT_NEED_MAP[s];
    out[s] = [...new Set(list.filter((x): x is string => typeof x === 'string' && knownIds.has(x)))].slice(0, NEED_MAX_SERVICES);
  }
  return out;
}
