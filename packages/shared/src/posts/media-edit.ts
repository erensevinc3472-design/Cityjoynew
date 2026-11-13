/**
 * Paylaşım düzenleyicisi (Karar Eren, 13 Kasım 2026): fotoğraf ya da videonun üstüne yazı, çıkartma ve çizim; videoda
 * kırpma, ses kapatma ve kapak karesi. Hiçbiri dosyanın içine işlenmez: gönderide küçük bir bilgi olarak saklanır ve
 * izlerken üstüne çizilir (ek sunucu işi ve depolama yok). Konumlar medyanın kendi çerçevesine göre 0-1 arasıdır;
 * boyutlar medya genişliğine oranlıdır, böylece akışta, tam ekranda ve panelde aynı yerde görünür.
 *
 * Kurallar yalnızca listenin boyutunu denetler (kural boyutu sınırı); içeriği okurken `sanitizeMediaEdit` temizler,
 * bozuk ya da fazla veri çizilmez.
 */

export const EDIT_FONTS = ['modern', 'klasik', 'el', 'kalin', 'daktilo'] as const;
export type EditFont = (typeof EDIT_FONTS)[number];

/** Yazı alt zemini: yok, dolu, yarı saydam. */
export const EDIT_TEXT_BG = ['yok', 'dolu', 'yari'] as const;
export type EditTextBg = (typeof EDIT_TEXT_BG)[number];

export const EDIT_ALIGN = ['left', 'center', 'right'] as const;
export type EditAlign = (typeof EDIT_ALIGN)[number];

/** Renk paleti (yazı, zemin, çizim). */
export const EDIT_COLORS = ['#FFFFFF', '#111111', '#E2B277', '#E74C3C', '#F39C12', '#F1C40F', '#2ECC71', '#3498DB', '#9B59B6', '#0E4F57'] as const;

export const STICKER_KINDS = ['emoji', 'konum', 'bahset', 'saat', 'hava', 'tarih', 'etiket'] as const;
export type StickerKind = (typeof STICKER_KINDS)[number];

export const MEDIA_EDIT_LIMITS = {
  /** Bir medyada en çok bu kadar yazı + çıkartma. */
  items: 20,
  text: 200,
  label: 60,
  strokes: 40,
  /** Bir çizgide en çok nokta (x,y çifti). */
  points: 400,
  /** Boyut: medya genişliğine oran. */
  size: [0.02, 0.4],
  scale: [0.3, 5],
} as const;

interface ItemBase {
  /** Medya çerçevesinde merkez, 0-1. */
  x: number;
  y: number;
  /** İki parmakla büyütme ve döndürme (derece). */
  scale: number;
  rotation: number;
}

export interface TextItem extends ItemBase {
  kind: 'yazi';
  text: string;
  font: EditFont;
  color: string;
  bg: EditTextBg;
  bgColor: string;
  align: EditAlign;
  /** Yazı boyutu: medya genişliğine oran (ör. 0.07). */
  size: number;
}

export interface StickerItem extends ItemBase {
  kind: 'cikartma';
  type: StickerKind;
  /** Emoji ya da görünen yazı ("Osmangazi, Bursa", "19:16", "#akşam"). */
  label: string;
  /** Bahset: kişinin kimliği (dokununca profili açılır). */
  uid?: string;
}

export type EditItem = TextItem | StickerItem;

export interface EditStroke {
  /** 0-1000 arası tamsayılar: x1 y1 x2 y2 ... (medya çerçevesine göre). */
  points: number[];
  color: string;
  /** Kalınlık: medya genişliğine oran. */
  width: number;
  marker?: boolean;
}

export interface MediaEdit {
  items?: EditItem[];
  strokes?: EditStroke[];
  /** Video: sesi kapalı paylaşıldı. */
  muted?: boolean;
  /** Video: oynatma aralığı (saniye). */
  trimStart?: number;
  trimEnd?: number;
  /** Video: akışta duruşta görünen kare (saniye). */
  coverAt?: number;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;
const num = (v: unknown, min: number, max: number, def: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def);
const color = (v: unknown, def: string) => (typeof v === 'string' && HEX.test(v) ? v : def);
const oneOf = <T extends string>(list: readonly T[], v: unknown, def: T): T => (list.includes(v as T) ? (v as T) : def);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

function base(o: Record<string, unknown>): ItemBase {
  return {
    x: round(num(o.x, 0, 1, 0.5)),
    y: round(num(o.y, 0, 1, 0.5)),
    scale: round(num(o.scale, MEDIA_EDIT_LIMITS.scale[0], MEDIA_EDIT_LIMITS.scale[1], 1), 3),
    rotation: Math.round(num(o.rotation, -360, 360, 0)),
  };
}

function itemOf(v: unknown): EditItem | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (o.kind === 'yazi') {
    const text = str(o.text, MEDIA_EDIT_LIMITS.text).trim();
    if (!text) return null;
    return {
      kind: 'yazi',
      ...base(o),
      text,
      font: oneOf(EDIT_FONTS, o.font, 'modern'),
      color: color(o.color, '#FFFFFF'),
      bg: oneOf(EDIT_TEXT_BG, o.bg, 'yok'),
      bgColor: color(o.bgColor, '#111111'),
      align: oneOf(EDIT_ALIGN, o.align, 'center'),
      size: round(num(o.size, MEDIA_EDIT_LIMITS.size[0], MEDIA_EDIT_LIMITS.size[1], 0.07)),
    };
  }
  if (o.kind === 'cikartma') {
    const label = str(o.label, MEDIA_EDIT_LIMITS.label).trim();
    if (!label) return null;
    const uid = typeof o.uid === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(o.uid) ? o.uid : undefined;
    return { kind: 'cikartma', ...base(o), type: oneOf(STICKER_KINDS, o.type, 'emoji'), label, ...(uid ? { uid } : {}) };
  }
  return null;
}

function strokeOf(v: unknown): EditStroke | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.points)) return null;
  const pts = (o.points as unknown[]).slice(0, MEDIA_EDIT_LIMITS.points * 2).map((n) => Math.round(num(n, 0, 1000, 0)));
  if (pts.length < 4) return null;
  if (pts.length % 2) pts.pop();
  return { points: pts, color: color(o.color, '#FFFFFF'), width: round(num(o.width, 0.004, 0.08, 0.012)), ...(o.marker === true ? { marker: true } : {}) };
}

/** Okunan (ya da yazılacak) düzenlemeyi temizler; boşsa null. `durationSec` verilirse video alanları da denetlenir. */
export function sanitizeMediaEdit(v: unknown, durationSec?: number): MediaEdit | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const items = Array.isArray(o.items) ? (o.items as unknown[]).slice(0, MEDIA_EDIT_LIMITS.items).map(itemOf).filter((i): i is EditItem => !!i) : [];
  const strokes = Array.isArray(o.strokes) ? (o.strokes as unknown[]).slice(0, MEDIA_EDIT_LIMITS.strokes).map(strokeOf).filter((s): s is EditStroke => !!s) : [];
  const out: MediaEdit = {};
  if (items.length) out.items = items;
  if (strokes.length) out.strokes = strokes;
  if (durationSec && durationSec > 0) {
    if (o.muted === true) out.muted = true;
    const start = round(num(o.trimStart, 0, durationSec, 0), 2);
    const end = round(num(o.trimEnd, 0, durationSec, durationSec), 2);
    if (end - start >= 1 && (start > 0.05 || end < durationSec - 0.05)) {
      out.trimStart = start;
      out.trimEnd = end;
    }
    if (typeof o.coverAt === 'number') out.coverAt = round(num(o.coverAt, 0, durationSec, 0), 2);
  }
  return Object.keys(out).length ? out : null;
}

/** Gönderinin düzenleme listesi (fotoğraf sırasına göre; videoda tek). Hiçbiri yoksa undefined. */
export function sanitizeMediaEdits(v: unknown, count: number, durationSec?: number): (MediaEdit | null)[] | undefined {
  if (!Array.isArray(v) || !count) return undefined;
  const list = (v as unknown[]).slice(0, Math.min(count, 10)).map((e) => sanitizeMediaEdit(e, durationSec));
  return list.some(Boolean) ? list : undefined;
}

/** Düzenlemelerdeki bütün yazılar (yasaklı kelime süzgeci ve moderasyon için). */
export function mediaEditTexts(edits: readonly (MediaEdit | null | undefined)[] | undefined): string[] {
  return (edits ?? []).flatMap((e) => (e?.items ?? []).map((i) => (i.kind === 'yazi' ? i.text : i.type === 'emoji' ? '' : i.label)).filter(Boolean));
}

/** Videonun oynatma aralığı (kırpma yoksa tamamı). */
export function playRange(edit: MediaEdit | null | undefined, durationSec: number): { start: number; end: number } {
  const start = edit?.trimStart ?? 0;
  const end = edit?.trimEnd ?? durationSec;
  return end - start >= 1 ? { start, end } : { start: 0, end: durationSec };
}
