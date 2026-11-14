/**
 * Keşfet gönderileri (PROJE.md 5.5). Kullanıcı yazısını paylaşırken "Nerede paylaşırsın?" sorusuna bir ya da birden
 * çok hedef seçer (Karar, Eren 28 Ekim 2026): Mahallem (yalnızca kendi mahallesi görür), Bölgesel (kendi ili), Genel
 * (herkes), Takip (yalnızca takipçiler). Anonim paylaşım yok, ad "Ayşe K." biçiminde. Emlak ilanı Keşfet'te
 * verilemez (madde 9). Üç şikâyette gönderi moderatör inceleyene kadar akıştan düşer (madde 8).
 */

import type { MediaEdit } from './media-edit';
import type { Photo } from '../media/photo';

/** Takip: yalnızca takipçiler görür (gizli hesapta takip isteği onaylananlar). */
export const POST_TARGETS = ['mahallem', 'bolgesel', 'genel', 'takip'] as const;
export type PostTarget = (typeof POST_TARGETS)[number];

/**
 * Resmî CityJoy hesabının "Nerede görünsün?" seçimi (Eren, 14 Kasım 2026). Yalnızca resmî hesap kullanır (kurallar):
 * Tüm Türkiye = Genel; il ve ilçe = Bölgesel (o ilin akışı); mahalle = Mahallem. Hepsi takipçilerin akışına da düşer.
 */
export const POST_REACHES = ['turkiye', 'il', 'ilce', 'mahalle'] as const;
export type PostReach = (typeof POST_REACHES)[number];

/** Seçilen yer için hedefler ve gönderinin konum alanı (il ve ilçe düzeyinde alt kademe "tum" ile doldurulur). */
export function reachPlan(
  reach: PostReach,
  place: { provinceCode?: string; districtId?: string; neighbourhoodId?: string },
  own: PostRegion,
): { targets: PostTarget[]; region: PostRegion } | null {
  if (reach === 'turkiye') return { targets: ['genel', 'takip'], region: own };
  const p = place.provinceCode;
  if (!p) return null;
  if (reach === 'il') return { targets: ['bolgesel', 'takip'], region: { provinceCode: p, districtId: `${p}-tum`, neighbourhoodId: `${p}-tum-tum` } };
  const d = place.districtId;
  if (!d) return null;
  if (reach === 'ilce') return { targets: ['bolgesel', 'takip'], region: { provinceCode: p, districtId: d, neighbourhoodId: `${d}-tum` } };
  const n = place.neighbourhoodId;
  return n ? { targets: ['mahallem', 'takip'], region: { provinceCode: p, districtId: d, neighbourhoodId: n } } : null;
}

/** Keşfet kuralları madde 6. Taziyeyi yalnızca yakını paylaşır (kullanıcı beyan eder) ya da muhtar. */
/** Gündem konuları: yalnızca Genel (ülke geneli) akışında (Eren, 12 Kasım 2026: "ekonomi, haber, spor gibi şeyler"). */
export const POST_TOPICS = ['haber', 'ekonomi', 'spor', 'teknoloji', 'kultur-sanat', 'saglik'] as const;
export const POST_CATEGORIES = ['genel', 'duyuru', 'etkinlik', 'firsat', 'soru-yardim', 'kayip-buluntu', 'taziye', ...POST_TOPICS] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];
export const isPostTopic = (c: PostCategory) => (POST_TOPICS as readonly string[]).includes(c);

/** onay-bekliyor: işletme yetkilisinin paylaşımı, sahibi onaylayana kadar akışta görünmez. */
export type PostStatus = 'aktif' | 'kaldirildi' | 'onay-bekliyor';

/** İşletme adına paylaşım: akışta işletmenin adıyla ve "İşletme" etiketiyle görünür, adına dokununca işletme sayfası açılır. */
export interface PostBusiness {
  id: string;
  name: string;
}

export interface PostRegion {
  provinceCode: string;
  districtId: string;
  neighbourhoodId: string;
}

/** Gönderi fotoğrafı: dosya `posts/{uid}/{postId}/{sıra}.jpg`; gönderi kaldırılınca ya da hesap silinince sunucu siler. */
export type PostPhoto = Photo;

export const postPhotoPath = (uid: string, postId: string, index: number) => `posts/${uid}/${postId}/${index}.jpg`;

/**
 * Gönderi videosu (PROJE.md 5.5 madde 2: en çok 60 sn): dosya `posts/{uid}/{postId}/video.mp4` (iPhone'da `.mov`).
 * Telefonda seçilirken süre ve boyut denetlenir; akışta kendiliğinden oynamaz (veri ve depolama maliyeti).
 */
export interface PostVideo {
  path: string;
  url: string;
  width: number;
  height: number;
  /** Saniye (1-60). */
  durationSec: number;
  /** Kapak karesi (düzenleyicide seçilir; aynı klasörde `cover.jpg`): akışta ve ızgarada video oynamadan görünür. */
  poster?: string;
}

export const POST_VIDEO_TYPES = { mp4: 'video/mp4', mov: 'video/quicktime' } as const;
export type PostVideoExt = keyof typeof POST_VIDEO_TYPES;
export const postVideoPath = (uid: string, postId: string, ext: PostVideoExt) => `posts/${uid}/${postId}/video.${ext}`;
export const postPosterPath = (uid: string, postId: string) => `posts/${uid}/${postId}/cover.jpg`;

export interface PostInput {
  /** Fotoğraf varsa boş olabilir. */
  text: string;
  category: PostCategory;
  targets: PostTarget[];
  /** Paylaşanın kayıtlı konumu (Mahallem ve Bölgesel buna göre süzülür). */
  region: PostRegion;
  photos?: PostPhoto[];
  /** Fotoğrafın yerine tek video (ikisi birlikte olmaz). */
  video?: PostVideo;
  /**
   * Paylaşım düzenleyicisi (media-edit.ts): fotoğraf sırasına göre (videoda tek) yazı, çıkartma, çizim; videoda kırpma,
   * ses ve kapak. Düzenlenmeyen medyada null.
   */
  edits?: (MediaEdit | null)[];
  /**
   * "{Şehir} kareleri"nde de görünsün (Seyahat; PROJE.md 13. madde 34): yalnızca fotoğraflı ve Genel'e paylaşılan
   * gönderide. Ek yükleme ya da kopya yok; aynı gönderi iki yerde görünür.
   */
  frames?: boolean;
  /**
   * Haberler'de de görünsün (Eren, 13 Kasım 2026): yalnızca yayıncı rozetli kişi seçebilir (kurallar denetler), kendi
   * ilinin Haberler > Bölgesel listesinde çıkar. Veritabanında `targets.haberler`. Tek başına da seçilebilir.
   */
  news?: boolean;
  /**
   * Etiketlenmek istenen kişiler (Eren, 13 Kasım 2026): "Kişileri etiketle" ve düzenleyicideki "Bahset" çıkartmaları.
   * Veritabanında `tagReq`; sunucu her kişinin "Beni kim etiketleyebilir" ayarını ve engellemeyi denetleyip uygun
   * olanları `tags` alanına yazar ve bildirim gönderir (istemci `tags` yazamaz).
   */
  tagRequest?: string[];
  /** Yalnızca resmî CityJoy hesabı: seçtiği yer (gönderide "Tüm Türkiye", "Bursa" gibi görünür). */
  reach?: PostReach;
}

export interface Post extends PostInput {
  id: string;
  status: PostStatus;
  authorUid: string;
  /** "Ayşe K." biçiminde; işletme paylaşımında işletmenin adı. */
  authorName: string;
  /** Paylaşan kişi değil işletme adına paylaşıldıysa. */
  business?: PostBusiness;
  likeCount: number;
  commentCount: number;
  /** Sahibi yorumları kapattı (Keşfet kuralları madde 3). */
  commentsOff: boolean;
  reportCount: number;
  /** Moderatör şikâyetleri inceleyip "yerinde kalsın" dedi. */
  cleared: boolean;
  /** CityJoy (admin) Karelerde öne çıkardı. */
  framesFeatured?: boolean;
  /** Yazarın hesabı askıda (yalnızca sunucu koyar): gönderi akışlarda görünmez. */
  authorSuspended?: boolean;
  /** İşletmenin Pro'su bitti, Ücretsiz sınırdan fazla (yalnızca sunucu koyar): silinmez, akışlarda görünmez; Pro dönünce açılır. */
  tierHidden?: boolean;
  /** Sunucunun onayladığı etiketler (kişi kimlikleri); kişi kendini çıkarabilir. Profilde "Etiketlendiklerim". */
  tags?: string[];
  /** Etiketlenenlerin adları ("Ayşe K."), etiket satırında okuma yapmadan göstermek için. */
  tagNames?: Record<string, string>;
  /** Sahibi profilinin en üstüne sabitledi (en çok PIN_LIMIT). */
  pinned?: boolean;
  /** Video izlenme sayısı (yalnızca sunucu artırır; kişi başına günde bir, en az 3 sn izlenince). */
  viewCount?: number;
  createdAt: string;
}

/** Profilde en üste sabitlenebilen gönderi. */
export const PIN_LIMIT = 3;

/** "Beni kim etiketleyebilir" (users/{uid}/settings/privacy). Varsayılan herkes. */
export const TAG_POLICIES = ['herkes', 'takip', 'kimse'] as const;
export type TagPolicy = (typeof TAG_POLICIES)[number];

/** Video en az bu kadar oynayınca izlenmiş sayılır. */
export const VIEW_MIN_SECONDS = 3;

/**
 * Etiket isteği: seçilen kişiler ve düzenleyicideki "Bahset" çıkartmaları birleşir; paylaşan kendisi ve tekrarlar
 * atılır, en çok POST_LIMITS.tags.
 */
export function postTagRequest(authorUid: string, chosen: readonly string[] | undefined, edits: PostInput['edits']): string[] {
  const fromStickers = (edits ?? []).flatMap((e) => (e?.items ?? []).flatMap((it) => (it.kind === 'cikartma' && it.type === 'bahset' && it.uid ? [it.uid] : [])));
  return [...new Set([...(chosen ?? []), ...fromStickers])].filter((u) => u && u !== authorUid && /^[A-Za-z0-9_-]{1,128}$/.test(u)).slice(0, POST_LIMITS.tags);
}

/** İzlenme sayısının kısa yazımı: 950, 4.579, 10,4B, 1,2Mn (Türkçe); diğer dillerde tarayıcının kısa biçimi. */
export function compactCount(n: number, locale: string): string {
  if (n < 10_000) return n.toLocaleString(locale);
  try {
    return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  } catch {
    return n.toLocaleString(locale);
  }
}

/** Kareler: sayfa başına küçük önizleme ve en üstteki öne çıkanlar. */
export const FRAMES_LIMITS = { pageSize: 30, featured: 6 } as const;

/** Gönderi Karelere girebilir mi: fotoğraflı ve herkese açık (Genel). */
export const canShowInFrames = (p: Pick<PostInput, 'photos' | 'targets'>) => !!p.photos?.length && p.targets.includes('genel');

export const POST_LIMITS = {
  text: [1, 2000],
  /** Gönderi başına en çok fotoğraf. */
  photos: 10,
  /** Gönderi videosu: en çok 60 saniye ve 40 MB (depolama maliyeti). */
  videoSeconds: 60,
  videoBytes: 40_000_000,
  /** Bu kadar şikâyette moderatör inceleyene kadar akıştan düşer. */
  reportThreshold: 3,
  /** Akışta bir seferde okunan gönderi (sayfalama, maliyet ilkesi). */
  pageSize: 20,
  /** Gönderi başına en çok etiketlenen kişi. */
  tags: 20,
} as const;

export const POST_REPORT_REASONS = ['nefret', 'taciz', 'dolandiricilik', 'spam', 'uygunsuz', 'emlak', 'diger'] as const;
export type PostReportReason = (typeof POST_REPORT_REASONS)[number];

export type PostError = 'text' | 'category' | 'targets' | 'region' | 'realEstate' | 'photos' | 'video';

/**
 * Satılık/kiralık taşınmaz ilanı sezgisi (madde 9): "satılık daire", "kiralık ev", "for rent" gibi. Kusursuz değildir;
 * kaçanlar "emlak" şikâyetiyle moderasyona düşer.
 */
const REAL_ESTATE =
  /(sat[ıi]l[ıi]k|kiral[ıi]k|for\s+(?:sale|rent)|zu\s+(?:verkaufen|vermieten)|للبيع|للإيجار|продам|сдам|сдаю|аренда)[\s:,-]*(?:[\p{L}\d+]+\s+){0,2}(daire|villa|arsa|tarla|d[üu]kk[aâ]n|i[şs]yeri|ofis|m[üu]stakil|apartment|flat|house|land|wohnung|haus|شقة|منزل|أرض|квартир|дом|участ|(?:ev|oda)(?:i|ler)?(?!\p{L}))/iu;

export const looksLikeRealEstate = (text: string) => REAL_ESTATE.test(text.toLocaleLowerCase('tr'));

export function validatePost(p: PostInput): PostError[] {
  const errors: PostError[] = [];
  const len = p.text.trim().length;
  const photos = p.photos?.length ?? 0;
  if ((len < POST_LIMITS.text[0] && !photos && !p.video) || len > POST_LIMITS.text[1]) errors.push('text');
  if (photos > POST_LIMITS.photos) errors.push('photos');
  if (p.video && (photos || !(p.video.durationSec >= 1 && p.video.durationSec <= POST_LIMITS.videoSeconds))) errors.push('video');
  // Gündem konusu seçilen gönderi Genel'de de yayınlanmalı.
  if (!POST_CATEGORIES.includes(p.category) || (isPostTopic(p.category) && !p.targets.includes('genel') && !p.news)) errors.push('category');
  if ((!p.targets.length && !p.news) || new Set(p.targets).size !== p.targets.length || p.targets.some((x) => !POST_TARGETS.includes(x))) errors.push('targets');
  const r = p.region;
  if (!/^[0-8][0-9]$/.test(r.provinceCode) || !r.districtId.startsWith(`${r.provinceCode}-`) || !r.neighbourhoodId.startsWith(`${r.districtId}-`)) errors.push('region');
  if (looksLikeRealEstate(p.text)) errors.push('realEstate');
  return errors;
}

/** Akışta görünür mü: kaldırılmamış ve şikâyetle düşmemiş. */
export function isPostListed(p: Pick<Post, 'status' | 'reportCount' | 'cleared' | 'authorSuspended' | 'tierHidden'>): boolean {
  return p.status === 'aktif' && !p.authorSuspended && !p.tierHidden && (p.cleared || p.reportCount < POST_LIMITS.reportThreshold);
}

/**
 * Yorumlar (madde 3): gönderiyi görebilen yazar, sahibi yorumları kapatabilir. Yorumu yazan ve gönderi sahibi siler;
 * yorum da şikâyet edilir, üç şikâyette moderatör inceleyene kadar gizlenir.
 */
export interface PostComment {
  id: string;
  postId: string;
  authorUid: string;
  /** "Ayşe K." biçiminde. */
  authorName: string;
  text: string;
  reportCount: number;
  cleared: boolean;
  createdAt: string;
}

export const COMMENT_LIMITS = {
  text: [1, 500],
  /** Gönderi başına bir seferde okunan yorum. */
  pageSize: 50,
} as const;

export const validateComment = (text: string) => {
  const len = text.trim().length;
  return len >= COMMENT_LIMITS.text[0] && len <= COMMENT_LIMITS.text[1];
};

export const isCommentListed = (c: Pick<PostComment, 'reportCount' | 'cleared'>) => c.cleared || c.reportCount < POST_LIMITS.reportThreshold;

/** Hedefler sabit sırada saklanır (aynı seçim aynı veri). */
export const normalizeTargets = (targets: PostTarget[]) => POST_TARGETS.filter((x) => targets.includes(x));
