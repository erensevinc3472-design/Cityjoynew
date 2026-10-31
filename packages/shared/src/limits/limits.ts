/**
 * Günlük sınırlar (PROJE.md 15.6, Eren onayladı 31 Ekim 2026). Her işlem bir sayaçla sayılır (`usage/{sahip~iş}`),
 * sınırı veritabanı kuralları denetler; sayılar panelden (admin, `config/limits`) değişir, boşsa buradaki varsayılan
 * geçerli. Yeni hesaplara (ilk 7 gün) daha düşük sınır. SOS, 112, hesap silme gibi hayati işler sınırlanmaz.
 * Kurum ve muhtar doğrudan yayında sınıra takılınca içerik engellenmez: onaya gönderilir (il yöneticisi / admin).
 */

/** Panelde değiştirilen sayılar; "Yeni" ile bitenler ilk 7 günün sınırı. */
export const DEFAULT_LIMITS = {
  gonderi: 10,
  gonderiYeni: 3,
  yorum: 100,
  yorumYeni: 30,
  takip: 200,
  takipYeni: 50,
  sohbet: 30,
  sohbetYeni: 10,
  ilan: 5,
  ilanYeni: 2,
  aktivite: 3,
  aktiviteYeni: 1,
  oneri: 5,
  oneriYeni: 2,
  sikayet: 20,
  isletmeGonderi: 5,
  muhtarDuyuru: 3,
  muhtarDuyuruHafta: 10,
  kurumDuyuru: 5,
  kurumDuyuruHafta: 20,
  acil: 3,
  etkinlik: 10,
} as const;

export type LimitKey = keyof typeof DEFAULT_LIMITS;
export type Limits = Record<LimitKey, number>;
export const LIMIT_KEYS = Object.keys(DEFAULT_LIMITS) as LimitKey[];
export const LIMIT_RANGE = [1, 10000] as const;

/** Panelde gruplar halinde gösterilir. */
export const LIMIT_GROUPS: { id: 'kullanici' | 'isletme' | 'muhtar' | 'kurum'; keys: LimitKey[] }[] = [
  { id: 'kullanici', keys: ['gonderi', 'gonderiYeni', 'yorum', 'yorumYeni', 'takip', 'takipYeni', 'sohbet', 'sohbetYeni', 'ilan', 'ilanYeni', 'aktivite', 'aktiviteYeni', 'oneri', 'oneriYeni', 'sikayet'] },
  { id: 'isletme', keys: ['isletmeGonderi'] },
  { id: 'muhtar', keys: ['muhtarDuyuru', 'muhtarDuyuruHafta', 'acil'] },
  { id: 'kurum', keys: ['kurumDuyuru', 'kurumDuyuruHafta', 'etkinlik'] },
];

export function normalizeLimits(raw: unknown): Limits {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out = { ...DEFAULT_LIMITS } as Limits;
  for (const k of LIMIT_KEYS) {
    const v = r[k];
    if (typeof v === 'number' && Number.isInteger(v) && v >= LIMIT_RANGE[0] && v <= LIMIT_RANGE[1]) out[k] = v;
  }
  return out;
}

/** Sayacın sahibi: kişi (u), işletme (b), kurum (k), kişi yetkisi (g: muhtar). */
export type UsageSubject = { type: 'u' | 'b' | 'k' | 'g'; id: string };

/** Sayılan işler; "duyuru-hafta" 7 günlük, diğerleri 24 saatlik pencere. */
export const USAGE_KINDS = ['gonderi', 'yorum', 'takip', 'aktivite', 'oneri', 'sikayet', 'isletme-gonderi', 'duyuru', 'duyuru-hafta', 'acil', 'etkinlik'] as const;
export type UsageKind = (typeof USAGE_KINDS)[number];

export function usageWindowMs(kind: UsageKind): number {
  return (kind === 'duyuru-hafta' ? 7 : 1) * 86_400_000;
}

export function usageId(subject: UsageSubject, kind: UsageKind): string {
  return `${subject.type}-${subject.id}~${kind}`;
}

/** İşin sınırı: kişide hesap yeniyse "Yeni" sınırı; duyuruda kurum ve muhtar ayrı. */
export function limitFor(kind: UsageKind, subject: UsageSubject, limits: Limits, newAccount: boolean): number {
  const user = (key: 'gonderi' | 'yorum' | 'takip' | 'aktivite' | 'oneri') => (newAccount ? limits[`${key}Yeni`] : limits[key]);
  switch (kind) {
    case 'gonderi':
    case 'yorum':
    case 'takip':
    case 'aktivite':
    case 'oneri':
      return user(kind);
    case 'sikayet':
      return limits.sikayet;
    case 'isletme-gonderi':
      return limits.isletmeGonderi;
    case 'duyuru':
      return subject.type === 'k' ? limits.kurumDuyuru : limits.muhtarDuyuru;
    case 'duyuru-hafta':
      return subject.type === 'k' ? limits.kurumDuyuruHafta : limits.muhtarDuyuruHafta;
    case 'acil':
      return limits.acil;
    case 'etkinlik':
      return limits.etkinlik;
  }
}

/** Hesap ilk 7 gününde mi (yeni hesap sınırı). */
export function isNewAccount(createdAt: string | null | undefined, now: Date): boolean {
  return !!createdAt && now.getTime() - new Date(createdAt).getTime() < 7 * 86_400_000;
}

export interface UsageState {
  windowStart: string;
  count: number;
}

/**
 * Sayaç bir sonraki işte ne olur: pencere dolduysa 1'den başlar. `allowed` false ise sınır dolmuştur; `resetAt` hakkın
 * yenileneceği an.
 */
export function nextUsage(old: UsageState | null, kind: UsageKind, limit: number, now: Date): { reset: boolean; count: number; allowed: boolean; resetAt: string } {
  const windowMs = usageWindowMs(kind);
  const expired = !old || now.getTime() - new Date(old.windowStart).getTime() >= windowMs;
  const count = expired ? 1 : old.count + 1;
  const start = expired ? now.getTime() : new Date(old.windowStart).getTime();
  return { reset: expired, count, allowed: count <= limit, resetAt: new Date(start + windowMs).toISOString() };
}

/** Sınır dolunca atılır; ekranlar "Bugünlük hakkın doldu, şu saatte yenilenir" gösterir. */
export class LimitReachedError extends Error {
  constructor(
    readonly kind: UsageKind,
    readonly resetAt: string,
  ) {
    super(`limit:${kind}`);
    this.name = 'LimitReachedError';
  }
}

export function isLimitReached(e: unknown): e is LimitReachedError {
  return e instanceof LimitReachedError || (typeof e === 'object' && e !== null && (e as { name?: string }).name === 'LimitReachedError');
}

/**
 * Kurum ya da muhtarın doğrudan yayınında sayılacak sayaçlar; il yöneticisinde yok (sınırsız). Acil duyuru kendi
 * sayacıyla, diğer duyurular günlük ve haftalık sayaçla, etkinlik kendi sayacıyla.
 */
export function publishUsage(
  author: { type: 'kurum'; orgId: string } | { type: 'kisi'; role: string; grantKey: string },
  what: { module: 'etkinlik' } | { module: 'duyuru'; kind: string },
): { subject: UsageSubject; kinds: UsageKind[] } | null {
  if (author.type === 'kisi' && author.role === 'il-yoneticisi') return null;
  const subject: UsageSubject = author.type === 'kurum' ? { type: 'k', id: author.orgId } : { type: 'g', id: author.grantKey };
  const kinds: UsageKind[] = what.module === 'etkinlik' ? ['etkinlik'] : what.kind === 'acil' ? ['acil'] : ['duyuru', 'duyuru-hafta'];
  return { subject, kinds };
}
