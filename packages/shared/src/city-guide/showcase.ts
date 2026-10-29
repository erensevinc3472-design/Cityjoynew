/**
 * Şehir Vitrini (tasarım: bursa-vitrini.html, "Haftanın Seçkisi"): il başına haftalık sayılar. Her sayıda birkaç
 * konu ("Bursa'nın iskendercileri", "Tarihi konaklarda bir gece") ve her konuda seçilmiş işletmeler ya da gezilecek
 * yerler. Editör seçkisidir: para karşılığı girilmez (ücretli öne çıkma ayrı ve "Reklam" etiketli). Ödeme sistemi
 * olmadığı için "Premium" yazmaz.
 */

export const SHOWCASE_THEMES = ['lezzet', 'tarih', 'doga', 'konaklama', 'alisveris', 'kultur', 'aile', 'gece'] as const;
export type ShowcaseTheme = (typeof SHOWCASE_THEMES)[number];

export interface ShowcaseItem {
  /** isletme: İşletmem kaydı; yer: Seyahat > gezilecek yer. */
  kind: 'isletme' | 'yer';
  id: string;
  /** Seçildiği andaki adı (listede ayrıca okumadan gösterilir). */
  name: string;
  /** Editörün kısa notu ("Tereyağını masada döküyorlar"). */
  note?: string;
}

export interface ShowcaseStory {
  title: string;
  subtitle?: string;
  body?: string;
  theme: ShowcaseTheme;
  items: ShowcaseItem[];
}

export type ShowcaseStatus = 'taslak' | 'yayinda';

export interface CityShowcase {
  id: string;
  provinceCode: string;
  /** Sayı numarası (1, 2, 3…). */
  issue: number;
  title: string;
  intro: string;
  /** Haftanın ilk günü (yyyy-aa-gg). */
  weekOf: string;
  stories: ShowcaseStory[];
  status: ShowcaseStatus;
  updatedAt: string;
}

export type CityShowcaseInput = Omit<CityShowcase, 'id' | 'updatedAt'>;

export const SHOWCASE_LIMITS = { title: 80, intro: 400, stories: 8, items: 8, storyTitle: 80, subtitle: 120, body: 800, note: 160 } as const;

export type ShowcaseError = 'title' | 'intro' | 'stories' | 'story' | 'week';

const len = (s?: string) => (s ?? '').trim().length;

export function validateShowcase(s: CityShowcaseInput): ShowcaseError[] {
  const L = SHOWCASE_LIMITS;
  const e: ShowcaseError[] = [];
  if (len(s.title) < 2 || len(s.title) > L.title) e.push('title');
  if (len(s.intro) > L.intro) e.push('intro');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.weekOf)) e.push('week');
  if (s.stories.length < 1 || s.stories.length > L.stories) e.push('stories');
  if (
    s.stories.some(
      (x) =>
        len(x.title) < 2 ||
        len(x.title) > L.storyTitle ||
        len(x.subtitle) > L.subtitle ||
        len(x.body) > L.body ||
        x.items.length > L.items ||
        (!x.items.length && len(x.body) < 10) ||
        x.items.some((i) => !i.id || len(i.name) < 1 || len(i.note) > L.note),
    )
  )
    e.push('story');
  return e;
}

/** En son yayındaki sayı önce. */
export const byIssueDesc = (a: Pick<CityShowcase, 'issue'>, b: Pick<CityShowcase, 'issue'>) => b.issue - a.issue;
