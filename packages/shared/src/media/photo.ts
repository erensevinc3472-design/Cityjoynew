import type { MembershipTier } from '../models/membership';

/**
 * Yüklenmiş fotoğraf (Firebase Storage; Blaze plan ister). Telefonda ya da panelde küçültülüp JPEG'e çevrilerek
 * yüklenir; konum ve cihaz bilgisi (EXIF) bu sırada atılır. Yüklenen dosya değiştirilemez; kayıttan çıkarılınca ya da
 * kayıt silinince dosyayı sunucu siler.
 */
export interface Photo {
  path: string;
  url: string;
  width: number;
  height: number;
}

/** En uzun kenar, JPEG kalitesi ve kuralların kabul ettiği en büyük dosya. */
export const PHOTO_UPLOAD = { maxEdge: 1600, quality: 0.7, maxBytes: 1_500_000 } as const;

/**
 * Gönderi dışındaki görseller `media/{yükleyen}/{tür}/{rastgele}.jpg` yolundadır: etkinlik kapağı, kurum logosu,
 * işletme logosu ve vitrini, kişinin profil fotoğrafı, Çarşı ilan fotoğrafları, aktivite kapağı, Seyahat
 * içeriklerinin kapakları (bölge, şehir, gezilecek yer, rota, yöresel, belediye tanıtımı). Kim hangi kayda bağlayabilir, o kaydın kuralı denetler.
 */
export const MEDIA_KINDS = ['etkinlik', 'kurum', 'isletme-logo', 'isletme-vitrin', 'profil', 'ilan', 'aktivite', 'seyahat'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const mediaPath = (uid: string, kind: MediaKind, fileId: string) => `media/${uid}/${kind}/${fileId}.jpg`;

/** Görselin kayıtlı yollarını toplar (sunucu, kayıttan çıkan dosyaları silmek için kullanır). */
export function photoPaths(...items: (Photo | readonly Photo[] | null | undefined)[]): string[] {
  return items.flatMap((x) => (!x ? [] : Array.isArray(x) ? x.map((p) => p.path) : [(x as Photo).path])).filter((p) => typeof p === 'string');
}

/** İşletme vitrininde kademeye göre en çok fotoğraf; sayılar panelden (Sınırlar) değişir. */
export const VITRIN_LIMIT_KEY = {
  ucretsiz: 'vitrinUcretsiz',
  pro: 'vitrinPro',
} as const satisfies Record<MembershipTier, string>;

/** Kayda yazılacak biçim: yalnızca bu dört alan, boyutlar tam sayı. */
export const cleanPhoto = (p: Photo): Photo => ({ path: p.path, url: p.url, width: Math.round(p.width), height: Math.round(p.height) });

const STORAGE_URL = /^(https:\/\/firebasestorage\.googleapis\.com|http:\/\/(127\.0\.0\.1|localhost|10\.0\.2\.2):9199)\/v0\/b\/[^/?]+\/o\/([^?]+)\?/;

/** Adres bizim dosya depomuzda ve bu yoldaki dosyayı mı gösteriyor (başka siteden görsel gösterilmez). */
export function isStoredPhoto(p: Pick<Photo, 'path' | 'url'>): boolean {
  const m = STORAGE_URL.exec(p.url);
  return !!m && decodeURIComponent(m[3]) === p.path;
}

/** Veritabanından okunan değer geçerli bir görselse döner. */
export function photoFrom(v: unknown): Photo | undefined {
  const p = v as Partial<Photo> | null | undefined;
  return p && typeof p.path === 'string' && typeof p.url === 'string' && typeof p.width === 'number' && typeof p.height === 'number'
    && p.width > 0 && p.height > 0 && isStoredPhoto(p as Photo)
    ? cleanPhoto(p as Photo)
    : undefined;
}

/**
 * Listelerde gösterilen küçük kopya (en uzun kenar 640 piksel). Sunucu her yüklenen JPEG'in küçüğünü `thumbs/{asıl yol}`
 * yoluna, asıl dosyanın erişim anahtarıyla yazar; böylece adres kayda yazılmadan asıl adresten hesaplanır. Küçük kopya
 * henüz yoksa (yeni yüklendi ya da eski fotoğraf) ekran asıl adrese döner.
 */
export const THUMB = { prefix: 'thumbs/', maxEdge: 640, quality: 70 } as const;

export const thumbPath = (path: string) => `${THUMB.prefix}${path}`;

/** Küçük kopyanın adresi; adres depomuzu göstermiyorsa asıl adres döner. */
export function thumbUrl(p: Pick<Photo, 'path' | 'url'>): string {
  const enc = encodeURIComponent(p.path);
  const at = p.url.indexOf(`/o/${enc}?`);
  if (at < 0 || p.path.startsWith(THUMB.prefix)) return p.url;
  return `${p.url.slice(0, at)}/o/${encodeURIComponent(thumbPath(p.path))}${p.url.slice(at + 3 + enc.length)}`;
}
