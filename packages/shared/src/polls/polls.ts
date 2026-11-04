/**
 * Anketler (PROJE.md 5.3, 13. madde 35). Anketleri kurumlar ve işletmeler CityJoy ekibi aracılığıyla yayınlar (ücretli;
 * ödeme ilk sürümde yok, ücret elle). Her ankette hazırlayanın adı yazar. Oy gizlidir: kimin neye oy verdiğini yalnızca
 * kendisi görür; toplu sayılar ankette tutulur, sonuçlar oy verince ya da anket bitince görünür. Siyasi parti, aday ve
 * seçim anketleri hukuk görüşüne kadar kapalı (panelde onay kutusu).
 */
export const POLL_LIMITS = { question: [5, 140], option: [1, 60], options: [2, 6], sponsor: [2, 80], maxDays: 60 } as const;

/** yayinda: oy açık (bitiş tarihine kadar); kapali: elle kapatıldı; gizlendi: listede yok. */
export type PollStatus = 'yayinda' | 'kapali' | 'gizlendi';

export interface PollOption {
  id: string;
  label: string;
}

export interface PollInput {
  question: string;
  options: PollOption[];
  /** Hazırlayan: "Osmangazi Belediyesi" gibi. */
  sponsorName: string;
  provinceCode: string;
  /** Yalnızca bir ilçeye yönelikse. */
  districtId?: string;
  /** yyyy-aa-gg; o gün sonuna kadar açık. */
  endsOn: string;
}

export interface Poll extends PollInput {
  id: string;
  status: PollStatus;
  counts: Record<string, number>;
  voteCount: number;
  createdAt: string;
}

const len = (s: string | undefined) => (s ?? '').trim().length;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export type PollError = 'question' | 'options' | 'sponsor' | 'endsOn';

export function validatePoll(p: PollInput, now = new Date()): PollError[] {
  const e: PollError[] = [];
  if (len(p.question) < POLL_LIMITS.question[0] || len(p.question) > POLL_LIMITS.question[1]) e.push('question');
  const labels = p.options.map((o) => o.label.trim());
  if (
    p.options.length < POLL_LIMITS.options[0] ||
    p.options.length > POLL_LIMITS.options[1] ||
    labels.some((l) => l.length < POLL_LIMITS.option[0] || l.length > POLL_LIMITS.option[1]) ||
    new Set(labels.map((l) => l.toLocaleLowerCase('tr'))).size !== labels.length
  )
    e.push('options');
  if (len(p.sponsorName) < POLL_LIMITS.sponsor[0] || len(p.sponsorName) > POLL_LIMITS.sponsor[1]) e.push('sponsor');
  const last = new Date(now.getTime() + POLL_LIMITS.maxDays * 86_400_000);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.endsOn) || p.endsOn < ymd(now) || p.endsOn > ymd(last)) e.push('endsOn');
  return e;
}

/** Oy hâlâ açık mı (yayında ve bitiş günü geçmedi)? */
export function pollOpen(p: Pick<Poll, 'status' | 'endsOn'>, now = new Date()): boolean {
  return p.status === 'yayinda' && p.endsOn >= ymd(now);
}

/** Bitişe kalan tam gün (bugün biterse 0). */
export function pollDaysLeft(p: Pick<Poll, 'endsOn'>, now = new Date()): number {
  const end = new Date(`${p.endsOn}T00:00:00`);
  const today = new Date(`${ymd(now)}T00:00:00`);
  return Math.max(0, Math.round((end.getTime() - today.getTime()) / 86_400_000));
}

/** Yüzdeler, toplamı 100 olacak biçimde (en büyük kalan yöntemi). */
export function pollPercents(p: Pick<Poll, 'options' | 'counts'>): Record<string, number> {
  const total = p.options.reduce((s, o) => s + (p.counts[o.id] ?? 0), 0);
  if (!total) return Object.fromEntries(p.options.map((o) => [o.id, 0]));
  const raw = p.options.map((o) => ({ id: o.id, v: ((p.counts[o.id] ?? 0) * 100) / total }));
  const floor = raw.map((r) => ({ ...r, f: Math.floor(r.v) }));
  let left = 100 - floor.reduce((s, r) => s + r.f, 0);
  [...floor].sort((a, b) => b.v - b.f - (a.v - a.f)).forEach((r) => left-- > 0 && (r.f += 1));
  return Object.fromEntries(floor.map((r) => [r.id, r.f]));
}

/** Seçenek kimlikleri sabit ve kısa (a, b, c…): oy belgesi ve sayılar bunlarla tutulur. */
export const pollOptionIds = (n: number) => 'abcdef'.slice(0, n).split('');
