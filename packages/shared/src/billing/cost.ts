/**
 * Özelliklere göre harcama (Eren, 13 Kasım 2026: "hangi özellik ne kadar harcıyor görelim, gerekirse kapatırız").
 *
 * İki kaynak:
 * - Uygulama: kullanıcıların küçük bir örneklemi (COST_SAMPLE_PCT) veritabanı okuma/yazmalarını koleksiyona göre sayar
 *   ve günde en çok birkaç kez tek çağrıyla gönderir (reportUsage). Panel örneklemi tüm kullanıcılara büyütür.
 * - Sunucu: her gece Google Cloud Monitoring'den sunucu işlerinin çalışma sayısı/süresi, toplam veritabanı işlemleri ve
 *   dosya indirme miktarı okunur (costReport).
 * Kayıtlar `billing/cost-{yyyymmdd}` belgelerindedir (yalnızca admin okur, yalnızca sunucu yazar).
 * Fiyatlar yaklaşıktır (ABD doları, Google'ın 2026 liste fiyatları; ücretsiz kota düşülmez): gerçek tutar Harcama
 * sayfasının üstündeki faturadır. Bu bölüm yalnızca payları gösterir.
 */

/** Ölçüm yapan kullanıcı oranı (yüzde). */
export const COST_SAMPLE_PCT = 5;

/** Bir rapordaki sınırlar (kötü niyetli ya da bozuk istek). */
export const USAGE_REPORT_LIMITS = { keys: 80, perKey: 1_000_000 } as const;

/** Yaklaşık birim fiyatlar (USD). */
export const COST_PRICES = {
  /** Firestore (eur3), 100.000 işlem başına. */
  read100k: 0.06,
  write100k: 0.18,
  delete100k: 0.02,
  /** Sunucu işi: milyon çağrı başına ve çalışma saniyesi başına (varsayılan 256 MB). */
  invocation1m: 0.4,
  instanceSecond: 0.000_007,
  /** Dosya indirme (GB başına) ve saklama (GB/ay). */
  egressGb: 0.12,
  storageGbMonth: 0.02,
} as const;

/** Kullanıcı örneklemde mi (kimliğe göre sabit; aynı kişi hep aynı sonuç). */
export function isCostSampled(uid: string, pct: number = COST_SAMPLE_PCT): boolean {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return h % 100 < pct;
}

export type UsageCounts = Record<string, number>;

export interface UsageReport {
  reads: UsageCounts;
  writes: UsageCounts;
}

const KEY = /^[A-Za-z][A-Za-z0-9]{0,39}$/;

function cleanCounts(v: unknown): UsageCounts | null {
  if (v == null) return {};
  if (typeof v !== 'object' || Array.isArray(v)) return null;
  const out: UsageCounts = {};
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
    if (!KEY.test(k) || typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > USAGE_REPORT_LIMITS.perKey) return null;
    if (n > 0) out[k] = n;
  }
  return Object.keys(out).length > USAGE_REPORT_LIMITS.keys ? null : out;
}

/** Uygulamadan gelen raporu temizler; geçersizse null. */
export function cleanUsageReport(data: unknown): UsageReport | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { reads?: unknown; writes?: unknown };
  const reads = cleanCounts(d.reads);
  const writes = cleanCounts(d.writes);
  return reads && writes ? { reads, writes } : null;
}

/** Özellik grupları: koleksiyon adı -> panelde görünen özellik. Listede olmayan "diger". */
export const COST_FEATURES = {
  kesfet: ['posts', 'postReports', 'commentReports'],
  takip: ['follows', 'blocks', 'publicProfiles', 'profileReports'],
  mesajlar: ['chats', 'chatQuota', 'messageReports'],
  etkinlik: ['events', 'activities', 'activityReports'],
  carsi: ['listings', 'listingQuota', 'listingReports'],
  isletme: ['businesses', 'businessFollows', 'businessPhones', 'deals', 'dealReports', 'reviewReports', 'payments'],
  seyahat: ['travelCities', 'travelLocal', 'travelMunicipal', 'travelPlaces', 'travelRegions', 'travelRoutes', 'holidayThemes'],
  sehir: [
    'cityGuide', 'cityGuidePacks', 'cityShowcases', 'organizations', 'orgMembers', 'officialProfiles', 'officialFollows',
    'officialStats', 'emergencyNumbers', 'roadsidePacks', 'serviceCategories', 'serviceSuggestions', 'announcements', 'sponsors', 'broadcasts',
  ],
  anket: ['polls', 'pollVotes', 'contests', 'contestVotes'],
  acil: ['sosAlerts', 'familyInvites', 'familyLinks', 'contacts'],
  hesap: ['users', 'pushTokens', 'usage', 'config', 'catalogVersions', 'occupations'],
} as const satisfies Record<string, readonly string[]>;

export type CostFeature = keyof typeof COST_FEATURES | 'diger';

const FEATURE_OF = new Map<string, CostFeature>(
  Object.entries(COST_FEATURES).flatMap(([f, cols]) => cols.map((c) => [c, f as CostFeature] as const)),
);

export function costFeatureOf(collection: string): CostFeature {
  return FEATURE_OF.get(collection) ?? 'diger';
}

/** Sunucu işleri -> özellik (panelde işler bu başlıklar altında da toplanır). */
export function functionFeatureOf(name: string): CostFeature {
  const n = name.toLowerCase();
  if (/business|store|tier|membership|deal|choosepost/.test(n)) return 'isletme';
  if (/travel/.test(n)) return 'seyahat';
  if (/listing/.test(n)) return 'carsi';
  if (/activity|event/.test(n)) return 'etkinlik';
  if (/post|frame|thumb|view|tag|translate/.test(n)) return 'kesfet';
  if (/follow|message|chat|profile/.test(n)) return 'takip';
  if (/weather|pharmacy|announcement|broadcast|sponsor/.test(n)) return 'sehir';
  if (/sos/.test(n)) return 'acil';
  if (/user|suspen|cleanup|budget|billing|cost|usage/.test(n)) return 'hesap';
  return 'diger';
}

export interface ServerUsage {
  /** İş adı -> çağrı sayısı ve çalışma süresi (saniye). */
  functions: Record<string, { calls: number; seconds: number }>;
  /** Projenin tüm veritabanı işlemleri (uygulama + sunucu + panel). */
  firestore: { reads: number; writes: number; deletes: number };
  /** Dosya indirme (bayt) ve saklanan toplam (bayt). */
  storage: { egressBytes: number; storedBytes: number };
}

/** Bir günlük kayıt (`billing/cost-{gün}`). */
export interface CostDay {
  day: string;
  /** Örneklemdeki kullanıcıların toplamı. */
  client?: { reporters: number; samplePct: number; reads: UsageCounts; writes: UsageCounts };
  server?: ServerUsage;
  serverError?: string;
}

export const firestoreUsd = (reads: number, writes: number, deletes = 0) =>
  (reads / 100_000) * COST_PRICES.read100k + (writes / 100_000) * COST_PRICES.write100k + (deletes / 100_000) * COST_PRICES.delete100k;

export const functionUsd = (calls: number, seconds: number) => (calls / 1_000_000) * COST_PRICES.invocation1m + seconds * COST_PRICES.instanceSecond;

const GB = 1024 ** 3;
export const storageUsd = (egressBytes: number, storedBytes: number, days: number) =>
  (egressBytes / GB) * COST_PRICES.egressGb + (storedBytes / GB) * COST_PRICES.storageGbMonth * (days / 30);

export interface FeatureCost {
  feature: CostFeature;
  /** Uygulamadan (tüm kullanıcılara büyütülmüş) okuma ve yazma. */
  reads: number;
  writes: number;
  /** Bu özelliğin sunucu işleri. */
  calls: number;
  usd: number;
  /** En çok harcayan koleksiyonlar (büyütülmüş okuma+yazma). */
  top: { name: string; reads: number; writes: number }[];
}

export interface CostSummary {
  days: number;
  features: FeatureCost[];
  functions: { name: string; feature: CostFeature; calls: number; seconds: number; usd: number }[];
  /** Toplam veritabanı (sunucu ölçümü) ve bunun uygulama dışında kalan kısmı (sunucu işleri, panel). */
  firestore: { reads: number; writes: number; deletes: number; usd: number; otherUsd: number };
  storage: { egressBytes: number; storedBytes: number; usd: number };
  usd: number;
}

/** Günlük kayıtları özetler: özellik başına tahmini tutar, en pahalıdan ucuza. */
export function summarizeCost(days: readonly CostDay[]): CostSummary {
  const byFeature = new Map<CostFeature, FeatureCost>();
  const cols = new Map<string, { reads: number; writes: number }>();
  const fns = new Map<string, { calls: number; seconds: number }>();
  const fsTotal = { reads: 0, writes: 0, deletes: 0 };
  const st = { egressBytes: 0, storedBytes: 0 };
  let clientReads = 0;
  let clientWrites = 0;
  for (const d of days) {
    if (d.client) {
      const scale = 100 / Math.max(1, d.client.samplePct);
      for (const [k, n] of Object.entries(d.client.reads)) {
        const c = cols.get(k) ?? { reads: 0, writes: 0 };
        c.reads += n * scale;
        cols.set(k, c);
        clientReads += n * scale;
      }
      for (const [k, n] of Object.entries(d.client.writes)) {
        const c = cols.get(k) ?? { reads: 0, writes: 0 };
        c.writes += n * scale;
        cols.set(k, c);
        clientWrites += n * scale;
      }
    }
    if (d.server) {
      for (const [name, f] of Object.entries(d.server.functions)) {
        const x = fns.get(name) ?? { calls: 0, seconds: 0 };
        x.calls += f.calls;
        x.seconds += f.seconds;
        fns.set(name, x);
      }
      fsTotal.reads += d.server.firestore.reads;
      fsTotal.writes += d.server.firestore.writes;
      fsTotal.deletes += d.server.firestore.deletes;
      st.egressBytes += d.server.storage.egressBytes;
      st.storedBytes = Math.max(st.storedBytes, d.server.storage.storedBytes);
    }
  }
  const feature = (f: CostFeature) => {
    let x = byFeature.get(f);
    if (!x) byFeature.set(f, (x = { feature: f, reads: 0, writes: 0, calls: 0, usd: 0, top: [] }));
    return x;
  };
  for (const [name, c] of cols) {
    const x = feature(costFeatureOf(name));
    x.reads += c.reads;
    x.writes += c.writes;
    x.usd += firestoreUsd(c.reads, c.writes);
    x.top.push({ name, reads: Math.round(c.reads), writes: Math.round(c.writes) });
  }
  const functions = [...fns].map(([name, f]) => ({ name, feature: functionFeatureOf(name), calls: f.calls, seconds: f.seconds, usd: functionUsd(f.calls, f.seconds) }));
  for (const f of functions) {
    const x = feature(f.feature);
    x.calls += f.calls;
    x.usd += f.usd;
  }
  const features = [...byFeature.values()]
    .map((x) => ({ ...x, reads: Math.round(x.reads), writes: Math.round(x.writes), top: x.top.sort((a, b) => b.reads + 3 * b.writes - (a.reads + 3 * a.writes)).slice(0, 4) }))
    .sort((a, b) => b.usd - a.usd);
  const fsUsd = firestoreUsd(fsTotal.reads, fsTotal.writes, fsTotal.deletes);
  const otherUsd = Math.max(0, fsUsd - firestoreUsd(clientReads, clientWrites));
  const stUsd = storageUsd(st.egressBytes, st.storedBytes, days.length);
  const fnUsd = functions.reduce((s, f) => s + f.usd, 0);
  return {
    days: days.length,
    features,
    functions: functions.sort((a, b) => b.usd - a.usd),
    firestore: { ...fsTotal, usd: fsUsd, otherUsd },
    storage: { ...st, usd: stUsd },
    usd: Math.max(fsUsd, firestoreUsd(clientReads, clientWrites)) + fnUsd + stUsd,
  };
}

/** Türkiye takvimine göre gün anahtarı (yyyymmdd). */
export function costDayKey(now: Date): string {
  return new Date(now.getTime() + 3 * 3600_000).toISOString().slice(0, 10).replace(/-/g, '');
}
