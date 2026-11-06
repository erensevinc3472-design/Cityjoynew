/**
 * İçerik istatistikleri (PROJE.md 6.1 ve 6.2 madde 22): resmî hesabın duyuru, haber, acil duyuru ve etkinliklerinin
 * kaç kişiye ulaştığı. Her kişi bir içeriği bir kez "okumuş" sayılır; kayıt kişinin kimliğini taşımaz. Kimlik yerine
 * kişinin kimliği ile içeriğin karması (SHA-256) belge adına yazılır: aynı kişi aynı içeriği iki kez sayamaz, ama
 * kayıttan kişiye geri gidilemez ve iki içeriğin okuru birbiriyle eşleştirilemez. Hesap silinince kayıt isimsiz kalır.
 */

import type { Announcement, AnnouncementAuthor } from '../announcements/announcements';

/** Okunma kaydı: `contentViews/{içerik}_{karma}`. */
export interface ContentView {
  /** İçeriğin kimliği. */
  item: string;
  /** a: duyuru / haber / acil, e: etkinlik. */
  k: 'a' | 'e';
  /** İçeriği yayınlayan hesap: kurum kimliği ya da kişi yetkisinin anahtarı (muhtarlıkta "mahalle-..."). */
  owner: string;
  /** İlk okunma anı. */
  at: string;
  /** Kişi içeriği paylaştı mı (bir kez sayılır). */
  sh: boolean;
}

/** İçeriği yayınlayan hesabın istatistik anahtarı (Takipçiler sayfasındaki hesap kimliğiyle aynı). */
export function contentOwnerOf(author: AnnouncementAuthor): string {
  return author.type === 'kurum' ? author.orgId : author.grantKey;
}

// ---- SHA-256 (kurallardaki hashing.sha256 ile aynı sonuç; telefonda ek paket gerekmez) ----

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** Metnin (UTF-8) SHA-256 karması, büyük harfli on altılık (kurallardaki toHexString() biçimi). */
export function sha256Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const bitLen = bytes.length * 8;
  const total = Math.ceil((bytes.length + 9) / 64) * 64;
  const msg = new Uint8Array(total);
  msg.set(bytes);
  msg[bytes.length] = 0x80;
  const view = new DataView(msg.buffer);
  view.setUint32(total - 8, Math.floor(bitLen / 0x100000000));
  view.setUint32(total - 4, bitLen >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, '0')).join('').toUpperCase();
}

/** Okunma kaydının belge adı: içerik + kişinin bu içeriğe özel karması (kurallar aynısını hesaplar). */
export function contentViewId(itemId: string, uid: string): string {
  return `${itemId}_${sha256Hex(uid + itemId)}`;
}

// ---- Panel: içerik başına sayılar ve öneriler ----

export type ContentKind = 'duyuru' | 'haber' | 'acil' | 'etkinlik';

/** Paneldeki satır: içerik ve sayıları. */
export interface ContentPerformance {
  id: string;
  kind: ContentKind;
  title: string;
  publishedAt: string;
  /** Tekil okuyan (kişi başına bir). */
  reads: number;
  /** Paylaşan kişi. */
  shares: number;
  /** Yalnızca etkinlikte: katılacağını bildiren. */
  attendees?: number;
}

export function contentKindOf(a: Pick<Announcement, 'kind'>): ContentKind {
  return a.kind === 'acil' ? 'acil' : a.kind === 'haber' ? 'haber' : 'duyuru';
}

/** Öneri kutusundaki tek bir bulgu (metni panel kurar). */
export type ContentInsight =
  | { type: 'enIyi'; id: string; title: string; reads: number }
  | { type: 'tur'; kind: ContentKind; avg: number; ratio: number }
  | { type: 'gun'; weekday: number; avg: number; ratio: number }
  | { type: 'saat'; band: 'sabah' | 'ogle' | 'aksam' | 'gece'; avg: number; ratio: number }
  | { type: 'erisim'; pct: number }
  | { type: 'paylasim'; pct: number }
  | { type: 'dusuk'; count: number };

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Saat dilimi (Türkiye saati, UTC+3). */
export function hourBand(iso: string): 'sabah' | 'ogle' | 'aksam' | 'gece' {
  const h = (new Date(iso).getUTCHours() + 3) % 24;
  return h >= 6 && h < 11 ? 'sabah' : h >= 11 && h < 17 ? 'ogle' : h >= 17 && h < 23 ? 'aksam' : 'gece';
}

/** Haftanın günü (Türkiye saati), 0 = Pazar. */
export function weekdayTr(iso: string): number {
  return new Date(new Date(iso).getTime() + 3 * 3600000).getUTCDay();
}

/** Bir öbeğin ortalaması genelden belirgin yüksekse (en az %25 ve en az 3 içerik) en iyisini döndürür. */
function bestGroup<K extends string | number>(rows: ContentPerformance[], keyOf: (r: ContentPerformance) => K, overall: number) {
  const groups = new Map<K, number[]>();
  for (const r of rows) groups.set(keyOf(r), [...(groups.get(keyOf(r)) ?? []), r.reads]);
  let best: { key: K; avg: number } | null = null;
  for (const [key, xs] of groups) {
    if (xs.length < 3) continue;
    const a = avg(xs);
    if (!best || a > best.avg) best = { key, avg: a };
  }
  return best && overall > 0 && best.avg >= overall * 1.25 ? { ...best, ratio: best.avg / overall } : null;
}

/**
 * Belediyenin işine yarayacak bulgular: en çok okunan, hangi tür / gün / saat daha çok okunuyor, içerikler takipçilerin
 * yüzde kaçına ulaşıyor, paylaşım oranı, az okunan içerik sayısı. Yeterli veri yoksa o bulgu çıkmaz (en az 5 içerik).
 */
export function contentInsights(rows: ContentPerformance[], followers: number | null): ContentInsight[] {
  const out: ContentInsight[] = [];
  if (!rows.length) return out;
  const top = rows.reduce((a, b) => (b.reads > a.reads ? b : a));
  if (top.reads > 0) out.push({ type: 'enIyi', id: top.id, title: top.title, reads: top.reads });
  const overall = avg(rows.map((r) => r.reads));
  if (followers && followers >= 10 && overall > 0) out.push({ type: 'erisim', pct: Math.min(100, Math.round((overall / followers) * 100)) });
  const reads = rows.reduce((a, r) => a + r.reads, 0);
  const shares = rows.reduce((a, r) => a + r.shares, 0);
  if (reads >= 20) out.push({ type: 'paylasim', pct: Math.round((shares / reads) * 1000) / 10 });
  if (rows.length < 5) return out;
  const kind = bestGroup(rows.filter((r) => r.kind !== 'acil'), (r) => r.kind, overall);
  if (kind) out.push({ type: 'tur', kind: kind.key, avg: Math.round(kind.avg), ratio: Math.round(kind.ratio * 10) / 10 });
  const day = bestGroup(rows, (r) => weekdayTr(r.publishedAt), overall);
  if (day) out.push({ type: 'gun', weekday: day.key, avg: Math.round(day.avg), ratio: Math.round(day.ratio * 10) / 10 });
  const band = bestGroup(rows, (r) => hourBand(r.publishedAt), overall);
  if (band) out.push({ type: 'saat', band: band.key, avg: Math.round(band.avg), ratio: Math.round(band.ratio * 10) / 10 });
  const m = median(rows.map((r) => r.reads));
  const low = rows.filter((r) => m >= 10 && r.reads < m / 2).length;
  if (low) out.push({ type: 'dusuk', count: low });
  return out;
}
