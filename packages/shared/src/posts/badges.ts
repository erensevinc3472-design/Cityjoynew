import type { LanguageCode } from '../i18n/languages';

/**
 * Keşfet rozetleri (Karar, Eren, 13 Kasım 2026): admin, keşfettiği ya da güvendiği kişiye panelden rozet verir
 * (Yayıncı, Gurme gibi; "o alanda iyi" anlamında). Kullanıcı rozet istemez, başvuru yoktur. Rozet listesini de admin
 * yönetir; panelde hiç kaydedilmemişse aşağıdaki hazır liste geçerlidir. Rozet adın yanında görünür.
 * "Yayıncı" türündeki rozet (publisher) ileride paylaşırken Haberler'i seçebilmeyi açar (PROJE.md 5.3).
 */

/** Rozet simgeleri (uygulamada Material simgesi). Panelde açıklamasıyla seçilir. */
export const BADGE_ICONS = [
  'newspaper',
  'restaurant',
  'explore',
  'photo-camera',
  'place',
  'star',
  'local-cafe',
  'sports-soccer',
  'palette',
  'music-note',
  'volunteer-activism',
  'workspace-premium',
] as const;
export type BadgeIcon = (typeof BADGE_ICONS)[number];

export interface BadgeDefinition {
  /** Kalıcı kimlik (küçük harf, rakam, tire); kişilerin profilinde bu yazılır. */
  id: string;
  /** Türkçe ad zorunlu; boş dillerde Türkçe gösterilir. */
  name: Partial<Record<LanguageCode, string>> & { tr: string };
  icon: BadgeIcon;
  /** Yayıncı rozeti: Haberler'e paylaşma hakkı (ileride). */
  publisher: boolean;
}

export const BADGE_LIMITS = {
  /** Bir kişide en çok bu kadar rozet. */
  perProfile: 3,
  /** Listede en çok bu kadar rozet. */
  definitions: 30,
  name: 24,
  id: 30,
} as const;

export const DEFAULT_BADGES: BadgeDefinition[] = [
  { id: 'yayinci', icon: 'newspaper', publisher: true, name: { tr: 'Yayıncı', en: 'Publisher', de: 'Herausgeber', ar: 'ناشر', ru: 'Издатель' } },
  { id: 'gurme', icon: 'restaurant', publisher: false, name: { tr: 'Gurme', en: 'Foodie', de: 'Feinschmecker', ar: 'ذوّاقة', ru: 'Гурман' } },
  { id: 'gezgin', icon: 'explore', publisher: false, name: { tr: 'Gezgin', en: 'Explorer', de: 'Entdecker', ar: 'رحّالة', ru: 'Путешественник' } },
  { id: 'fotografci', icon: 'photo-camera', publisher: false, name: { tr: 'Fotoğrafçı', en: 'Photographer', de: 'Fotograf', ar: 'مصوّر', ru: 'Фотограф' } },
  { id: 'yerel-rehber', icon: 'place', publisher: false, name: { tr: 'Yerel rehber', en: 'Local guide', de: 'Lokaler Guide', ar: 'دليل محلي', ru: 'Местный гид' } },
];

const LANGS: LanguageCode[] = ['tr', 'en', 'de', 'ar', 'ru'];
const ID_RE = /^[a-z0-9-]{2,30}$/;

/** Türkçe addan kimlik üretir ("Yerel rehber" -> "yerel-rehber"). */
export function badgeIdFromName(name: string): string {
  const map: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
  return name
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşüâîû]/g, (ch) => map[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, BADGE_LIMITS.id);
}

/** Panelden gelen listeyi temizler: geçersiz, adsız ve tekrar eden kimlikli rozetler atılır. */
export function cleanBadgeDefinitions(items: readonly BadgeDefinition[]): BadgeDefinition[] {
  const seen = new Set<string>();
  const out: BadgeDefinition[] = [];
  for (const b of items) {
    const tr = (b.name?.tr ?? '').trim().slice(0, BADGE_LIMITS.name);
    if (!tr || !ID_RE.test(b.id) || seen.has(b.id) || !(BADGE_ICONS as readonly string[]).includes(b.icon)) continue;
    seen.add(b.id);
    const name: BadgeDefinition['name'] = { tr };
    for (const l of LANGS) {
      const v = (b.name?.[l] ?? '').trim().slice(0, BADGE_LIMITS.name);
      if (l !== 'tr' && v) name[l] = v;
    }
    out.push({ id: b.id, name, icon: b.icon, publisher: b.publisher === true });
    if (out.length >= BADGE_LIMITS.definitions) break;
  }
  return out;
}

/** Rozetin seçili dildeki adı (yoksa Türkçe). */
export const badgeName = (b: BadgeDefinition, lang: LanguageCode) => b.name[lang] || b.name.tr;

/** Kişinin rozet kimliklerinden listede hâlâ olanlar (silinen rozet görünmez), en çok 3. */
export function profileBadges(ids: readonly string[] | undefined, defs: readonly BadgeDefinition[]): BadgeDefinition[] {
  if (!ids?.length) return [];
  return ids.map((id) => defs.find((d) => d.id === id)).filter((d): d is BadgeDefinition => !!d).slice(0, BADGE_LIMITS.perProfile);
}
