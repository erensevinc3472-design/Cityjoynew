/**
 * Bildirimler (PROJE.md 5.12, 7). Uygulama içi bildirim merkezi: kişinin zaten okuduğu kaynaklardan (duyuru, kurum
 * haberi, etkinlik, mesaj, takip, SOS) son 14 günün olayları toplanır; her olay için ayrıca bir belge yazılmaz (sunucu
 * işlevi ve ek yazma maliyeti yok). Telefona anlık bildirim (push) telefon sürümüyle gelir; buradaki tercihler ve sessiz
 * saatler o zaman da kullanılır.
 */
export const NOTIFICATION_CATEGORIES = ['acil', 'sos', 'mesaj', 'takip', 'duyuru', 'haber', 'etkinlik'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/** Acil kamu duyurusu ve SOS varsayılan açıktır; kapatılırsa kişi uyarılır (PROJE.md 5.12). Panel bunları kapatamaz. */
export const CRITICAL_CATEGORIES: readonly NotificationCategory[] = ['acil', 'sos'];

export const NOTIFICATION_LIMITS = {
  /** Bildirim merkezinde gösterilen en eski olay. */
  days: 14,
  maxItems: 60,
  /** Telefonda saklanan "okundu" kimlikleri. */
  readIds: 300,
} as const;

export interface QuietHours {
  enabled: boolean;
  /** Saat (0-23). Başlangıç bitişten büyükse gece yarısını aşar (22 > 8). */
  start: number;
  end: number;
}

/** Kişinin tercihleri (kendi özel belgesinde; yalnızca kendisi okur ve yazar). */
export interface NotificationPrefs {
  categories: Record<NotificationCategory, boolean>;
  quietHours: QuietHours;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  categories: { acil: true, sos: true, mesaj: true, takip: true, duyuru: true, haber: true, etkinlik: true },
  quietHours: { enabled: false, start: 22, end: 8 },
};

/** Panel (admin): hangi olaylar bildirim üretir. Acil ve SOS her zaman açık. */
export type NotificationTriggers = Record<NotificationCategory, boolean>;
export const DEFAULT_NOTIFICATION_TRIGGERS: NotificationTriggers = { ...DEFAULT_NOTIFICATION_PREFS.categories };

/** Eksik ya da bozuk kaydı varsayılanla tamamlar; kritik kategoriler tetikleyicide hep açık kalır. */
export function normalizePrefs(raw: unknown): NotificationPrefs {
  const r = (raw ?? {}) as Partial<NotificationPrefs>;
  const categories = { ...DEFAULT_NOTIFICATION_PREFS.categories };
  for (const c of NOTIFICATION_CATEGORIES) if (typeof r.categories?.[c] === 'boolean') categories[c] = r.categories[c];
  const q = r.quietHours;
  const hour = (h: unknown, d: number) => (Number.isInteger(h) && (h as number) >= 0 && (h as number) <= 23 ? (h as number) : d);
  return {
    categories,
    quietHours: { enabled: q?.enabled === true, start: hour(q?.start, 22), end: hour(q?.end, 8) },
  };
}

export function normalizeTriggers(raw: unknown): NotificationTriggers {
  const r = (raw ?? {}) as Partial<NotificationTriggers>;
  const out = { ...DEFAULT_NOTIFICATION_TRIGGERS };
  for (const c of NOTIFICATION_CATEGORIES) if (typeof r[c] === 'boolean') out[c] = r[c];
  for (const c of CRITICAL_CATEGORIES) out[c] = true;
  return out;
}

/** Sessiz saatlerde mi (telefona bildirim gelince kullanılır; kritik kategoriler sessiz saatte de gelir). */
export function inQuietHours(q: QuietHours, at: Date): boolean {
  return quietAtHour(q, at.getHours());
}

/** Saat (0-23) sessiz aralıkta mı. Sunucu telefonun saatini bilmez, Türkiye saatini verir (turkeyHour). */
export function quietAtHour(q: QuietHours, h: number): boolean {
  if (!q.enabled || q.start === q.end) return false;
  return q.start < q.end ? h >= q.start && h < q.end : h >= q.start || h < q.end;
}

/** Türkiye saati (UTC+3, yaz saati uygulaması yok). Sunucu UTC çalışır. */
export function turkeyHour(at: Date): number {
  return (at.getUTCHours() + 3) % 24;
}

export interface AppNotification {
  /** Kaynağa göre sabit kimlik ("duyuru:abc", "mesaj:sohbet:sonMesaj"): okundu bilgisi buna bağlanır. */
  id: string;
  category: NotificationCategory;
  title: string;
  body?: string;
  /** ISO. */
  at: string;
  /** Dokununca açılacak ekran. */
  href: { pathname: string; params?: Record<string, string> };
}

/** Kaynaklardan gelenleri birleştirir: kapalı kategoriler ve 14 günden eskiler çıkar, en yeni üstte, en çok 60. */
export function collectNotifications(items: readonly AppNotification[], prefs: NotificationPrefs, triggers: NotificationTriggers, now = new Date()): AppNotification[] {
  const oldest = now.getTime() - NOTIFICATION_LIMITS.days * 24 * 60 * 60 * 1000;
  const seen = new Set<string>();
  return items
    .filter((n) => prefs.categories[n.category] && triggers[n.category] && new Date(n.at).getTime() >= oldest)
    .filter((n) => !seen.has(n.id) && !!seen.add(n.id))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, NOTIFICATION_LIMITS.maxItems);
}

/** Okundu bilgisi (telefonda): "tümünü okundu say" anı ve tek tek açılanlar. */
export interface ReadState {
  until: string | null;
  ids: string[];
}

export function isUnread(n: AppNotification, read: ReadState): boolean {
  return (!read.until || n.at > read.until) && !read.ids.includes(n.id);
}

export function markRead(read: ReadState, id: string): ReadState {
  return read.ids.includes(id) ? read : { ...read, ids: [id, ...read.ids].slice(0, NOTIFICATION_LIMITS.readIds) };
}
