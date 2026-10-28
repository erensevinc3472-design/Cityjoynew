/**
 * Keşfet gönderileri (PROJE.md 5.5). Kullanıcı yazısını paylaşırken "Nerede paylaşırsın?" sorusuna bir ya da birden
 * çok hedef seçer (Karar, Eren 28 Ekim 2026): Mahallem (yalnızca kendi mahallesi görür), Bölgesel (kendi ili), Genel
 * (herkes). Takip hedefi takip sistemiyle gelecek. Anonim paylaşım yok, ad "Ayşe K." biçiminde. Emlak ilanı Keşfet'te
 * verilemez (madde 9). Üç şikâyette gönderi moderatör inceleyene kadar akıştan düşer (madde 8).
 */

export const POST_TARGETS = ['mahallem', 'bolgesel', 'genel'] as const;
export type PostTarget = (typeof POST_TARGETS)[number];

/** Keşfet kuralları madde 6. Taziyeyi yalnızca yakını paylaşır (kullanıcı beyan eder) ya da muhtar. */
export const POST_CATEGORIES = ['genel', 'duyuru', 'etkinlik', 'firsat', 'soru-yardim', 'kayip-buluntu', 'taziye'] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];

export type PostStatus = 'aktif' | 'kaldirildi';

export interface PostRegion {
  provinceCode: string;
  districtId: string;
  neighbourhoodId: string;
}

export interface PostInput {
  text: string;
  category: PostCategory;
  targets: PostTarget[];
  /** Paylaşanın kayıtlı konumu (Mahallem ve Bölgesel buna göre süzülür). */
  region: PostRegion;
}

export interface Post extends PostInput {
  id: string;
  status: PostStatus;
  authorUid: string;
  /** "Ayşe K." biçiminde. */
  authorName: string;
  likeCount: number;
  commentCount: number;
  /** Sahibi yorumları kapattı (Keşfet kuralları madde 3). */
  commentsOff: boolean;
  reportCount: number;
  /** Moderatör şikâyetleri inceleyip "yerinde kalsın" dedi. */
  cleared: boolean;
  createdAt: string;
}

export const POST_LIMITS = {
  text: [1, 2000],
  /** Bu kadar şikâyette moderatör inceleyene kadar akıştan düşer. */
  reportThreshold: 3,
  /** Akışta bir seferde okunan gönderi (sayfalama, maliyet ilkesi). */
  pageSize: 20,
} as const;

export const POST_REPORT_REASONS = ['nefret', 'taciz', 'dolandiricilik', 'spam', 'uygunsuz', 'emlak', 'diger'] as const;
export type PostReportReason = (typeof POST_REPORT_REASONS)[number];

export type PostError = 'text' | 'category' | 'targets' | 'region' | 'realEstate';

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
  if (len < POST_LIMITS.text[0] || len > POST_LIMITS.text[1]) errors.push('text');
  if (!POST_CATEGORIES.includes(p.category)) errors.push('category');
  if (!p.targets.length || new Set(p.targets).size !== p.targets.length || p.targets.some((x) => !POST_TARGETS.includes(x))) errors.push('targets');
  const r = p.region;
  if (!/^[0-8][0-9]$/.test(r.provinceCode) || !r.districtId.startsWith(`${r.provinceCode}-`) || !r.neighbourhoodId.startsWith(`${r.districtId}-`)) errors.push('region');
  if (looksLikeRealEstate(p.text)) errors.push('realEstate');
  return errors;
}

/** Akışta görünür mü: kaldırılmamış ve şikâyetle düşmemiş. */
export function isPostListed(p: Pick<Post, 'status' | 'reportCount' | 'cleared'>): boolean {
  return p.status === 'aktif' && (p.cleared || p.reportCount < POST_LIMITS.reportThreshold);
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
