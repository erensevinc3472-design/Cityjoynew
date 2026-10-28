import { ageGroup } from '../models/user';

/**
 * Kullanıcı aktiviteleri (PROJE.md 5.3, Eren'in kararı): her kullanıcı "+" ile bir araya gelme çağrısı açar
 * (yürüyüş, kahve, oyun...). Etkinlikten farkı: onay yok, kullanıcı açar. Herkes yalnızca mahalleyi görür; tam buluşma
 * adresi yalnızca "Katılıyorum" diyene görünür (Eren onayladı). Güvenlik (Claude, standart): yalnızca 18 yaş ve
 * üstü açar ve katılır, ilk buluşma ipuçları gösterilir, şikâyet edilebilir; üç şikâyette moderatör inceleyene kadar
 * listeden düşer. Değişiklik bildirimi sunucu işleviyle gelecek (Blaze); bu yüzden açılan aktivitenin tarihi ve yeri
 * değiştirilemez, gerekirse iptal edilip yenisi açılır (sürprizsiz bilgi).
 */

export const ACTIVITY_CATEGORIES = ['yuruyus-doga', 'spor', 'kahve-sohbet', 'oyun', 'kitap-kultur', 'cocuk-aile', 'ogrenme', 'gonullu', 'diger'] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

/** aktif: listede; iptal: "İptal edildi" etiketiyle başlangıcına kadar görünür; kaldirildi: moderatör ya da sahibi kaldırdı. */
export type ActivityStatus = 'aktif' | 'iptal' | 'kaldirildi';

export interface ActivityRegion {
  provinceCode: string;
  districtId: string;
  neighbourhoodId: string;
}

export interface ActivityInput {
  title: string;
  description: string;
  category: ActivityCategory;
  /** ISO tarihler. */
  startsAt: string;
  endsAt: string;
  /** Herkese görünen genel yer: mahalle. */
  region: ActivityRegion;
  /** Tam buluşma yeri: yalnızca düzenleyen ve katılanlar görür. */
  address: string;
  capacity: number;
}

export interface Activity extends Omit<ActivityInput, 'address'> {
  id: string;
  status: ActivityStatus;
  organizerUid: string;
  /** "Ayşe K." biçiminde. */
  organizerName: string;
  attendeeCount: number;
  reportCount: number;
  /** Moderatör şikâyetleri inceleyip "yerinde kalsın" dedi: şikâyet sayısıyla listeden düşmez. */
  cleared: boolean;
  createdAt: string;
}

export const ACTIVITY_LIMITS = {
  title: [3, 80],
  description: [10, 1000],
  address: [5, 200],
  /** Düzenleyen hariç katılımcı sayısı. */
  capacity: [1, 50],
  /** En çok kaç gün sonrası için açılır. */
  maxDaysAhead: 30,
  /** En çok kaç saat sürer. */
  maxHours: 12,
  /** Bu kadar şikâyette moderatör inceleyene kadar listeden düşer. */
  reportThreshold: 3,
} as const;

export const ACTIVITY_REPORT_REASONS = ['tehlikeli', 'uygunsuz', 'ticari', 'sahte', 'diger'] as const;
export type ActivityReportReason = (typeof ACTIVITY_REPORT_REASONS)[number];

export type ActivityError = 'title' | 'description' | 'category' | 'dates' | 'address' | 'capacity' | 'region';

export function validateActivity(a: ActivityInput, now = new Date()): ActivityError[] {
  const errors: ActivityError[] = [];
  const len = (s: string) => s.trim().length;
  const within = (n: number, [min, max]: readonly [number, number]) => n >= min && n <= max;
  const L = ACTIVITY_LIMITS;
  if (!within(len(a.title), L.title)) errors.push('title');
  if (!within(len(a.description), L.description)) errors.push('description');
  if (!ACTIVITY_CATEGORIES.includes(a.category)) errors.push('category');
  const start = new Date(a.startsAt).getTime();
  const end = new Date(a.endsAt).getTime();
  if (!(start > now.getTime()) || !(end > start) || end - start > L.maxHours * 3600000 || start - now.getTime() > L.maxDaysAhead * 86400000) errors.push('dates');
  if (!within(len(a.address), L.address)) errors.push('address');
  if (!Number.isInteger(a.capacity) || !within(a.capacity, L.capacity)) errors.push('capacity');
  const r = a.region;
  if (!/^[0-8][0-9]$/.test(r.provinceCode) || !r.districtId.startsWith(`${r.provinceCode}-`) || !r.neighbourhoodId.startsWith(`${r.districtId}-`)) errors.push('region');
  return errors;
}

/** Aktivite açıp katılabilir mi (18 yaş ve üstü; doğum yılıyla, kurallarla aynı hesap). */
export const canUseActivities = (birthYear: number | undefined, now = new Date()) => !!birthYear && ageGroup(birthYear, now) === 'yetiskin';

/** Listede görünür mü: başlamamış (iptal edilmişse de etiketle) ve şikâyetle düşmemiş. */
export function isActivityListed(a: Pick<Activity, 'status' | 'startsAt' | 'reportCount' | 'cleared'>, now = new Date()): boolean {
  if (a.status === 'kaldirildi' || new Date(a.startsAt) <= now) return false;
  return a.cleared || a.reportCount < ACTIVITY_LIMITS.reportThreshold;
}

/** "Katılıyorum" alınır mı: aktif, başlamamış, yer var. */
export function canJoinActivity(a: Pick<Activity, 'status' | 'startsAt' | 'capacity' | 'attendeeCount'>, now = new Date()): boolean {
  return a.status === 'aktif' && new Date(a.startsAt) > now && a.attendeeCount < a.capacity;
}

/** Yakında başlayan önce; iptaller sonda. */
export function sortActivities<T extends Pick<Activity, 'startsAt' | 'status'>>(list: T[]): T[] {
  return [...list].sort((a, b) => Number(a.status === 'iptal') - Number(b.status === 'iptal') || a.startsAt.localeCompare(b.startsAt));
}
