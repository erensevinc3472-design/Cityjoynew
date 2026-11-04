/**
 * Yarışmalar (PROJE.md 5.3, 13. madde 35). Admin yayınlar (kurum talepleri sonra). Aşamalar: il > bölge > Türkiye;
 * her aşamanın birincisi bir sonrakine geçer ve beğeniyle (oyla) seçilir. Katılım ücretsiz; katılımcı videosunu bir
 * video sitesine yükleyip bağlantısını gönderir (uygulamaya video yükleme Storage / Blaze ile gelecek), ekip onaylar.
 * Oy kuralları: giriş ve doğrulanmış e-posta (telefon doğrulaması Blaze ile), yarışmacı başına tek oy, günlük oy sınırı
 * (yeni hesaplara daha düşük), kendine oy yok, şüpheli oylar sayılmaz (admin diskalifiye eder).
 */
export const CONTEST_STAGES = ['il', 'bolge', 'turkiye'] as const;
export type ContestStage = (typeof CONTEST_STAGES)[number];

/** katilim: başvurular açık; oylama: oy açık; sonuc: sonuçlar açıklandı; gizlendi: listede yok. */
export type ContestStatus = 'katilim' | 'oylama' | 'sonuc' | 'gizlendi';
export type EntryStatus = 'bekliyor' | 'onayli' | 'diskalifiye';

export const CONTEST_LIMITS = { title: [3, 80], description: [10, 400], prize: 120, terms: [20, 6000], name: [2, 40], note: 200, url: 300 } as const;

export interface ContestInput {
  title: string;
  description: string;
  /** Boşsa ödülsüz. */
  prize?: string;
  stage: ContestStage;
  /** İl aşamasında il kodu; bölge ve Türkiye aşamasında boş. */
  provinceCode?: string;
  /** Bölge aşamasında bölge adı ("Marmara"). */
  regionName?: string;
  /** Kaç aşamalı (1-3): ilk kampanya tek aşamalı başlayabilir. */
  stageCount: 1 | 2 | 3;
  /** yyyy-aa-gg. */
  joinEndsOn: string;
  voteEndsOn: string;
  /** Şartname (katılım koşulları, veli izni, içerik kullanım izni, telif, ödül ve vergi, KVKK, diskalifiye). */
  terms: string;
}

export interface Contest extends ContestInput {
  id: string;
  status: ContestStatus;
  entryCount: number;
  createdAt: string;
}

export interface ContestEntry {
  /** Katılımcının kullanıcı kimliği (yarışma başına tek katılım). */
  id: string;
  contestId: string;
  displayName: string;
  mediaUrl: string;
  note?: string;
  status: EntryStatus;
  voteCount: number;
  createdAt: string;
}

const len = (s: string | undefined) => (s ?? '').trim().length;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type ContestError = 'title' | 'description' | 'prize' | 'region' | 'dates' | 'terms';

export function validateContest(c: ContestInput): ContestError[] {
  const e: ContestError[] = [];
  if (len(c.title) < CONTEST_LIMITS.title[0] || len(c.title) > CONTEST_LIMITS.title[1]) e.push('title');
  if (len(c.description) < CONTEST_LIMITS.description[0] || len(c.description) > CONTEST_LIMITS.description[1]) e.push('description');
  if (len(c.prize) > CONTEST_LIMITS.prize) e.push('prize');
  if ((c.stage === 'il' && !/^\d{2}$/.test(c.provinceCode ?? '')) || (c.stage === 'bolge' && len(c.regionName) < 2)) e.push('region');
  if (!DATE.test(c.joinEndsOn) || !DATE.test(c.voteEndsOn) || c.voteEndsOn < c.joinEndsOn) e.push('dates');
  if (len(c.terms) < CONTEST_LIMITS.terms[0] || len(c.terms) > CONTEST_LIMITS.terms[1]) e.push('terms');
  return e;
}

export type EntryError = 'name' | 'url' | 'note' | 'terms';

/** Katılım: görünen ad, https video bağlantısı, kısa not, şartname onayı. */
export function validateEntry(e: { displayName: string; mediaUrl: string; note?: string; accepted: boolean }): EntryError[] {
  const out: EntryError[] = [];
  if (len(e.displayName) < CONTEST_LIMITS.name[0] || len(e.displayName) > CONTEST_LIMITS.name[1]) out.push('name');
  if (!/^https:\/\/[^\s]+$/i.test(e.mediaUrl.trim()) || e.mediaUrl.trim().length > CONTEST_LIMITS.url) out.push('url');
  if (len(e.note) > CONTEST_LIMITS.note) out.push('note');
  if (!e.accepted) out.push('terms');
  return out;
}

/** Oylamada en çok oy alan önde; eşitlikte önce katılan. */
export function rankEntries(list: readonly ContestEntry[]): ContestEntry[] {
  return [...list].filter((x) => x.status === 'onayli').sort((a, b) => b.voteCount - a.voteCount || a.createdAt.localeCompare(b.createdAt));
}

/** Listede önce oylaması / katılımı süren, sonra sonuçlananlar. */
export function sortContests(list: readonly Contest[]): Contest[] {
  const rank: Record<ContestStatus, number> = { oylama: 0, katilim: 1, sonuc: 2, gizlendi: 3 };
  return [...list].sort((a, b) => rank[a.status] - rank[b.status] || a.voteEndsOn.localeCompare(b.voteEndsOn));
}
