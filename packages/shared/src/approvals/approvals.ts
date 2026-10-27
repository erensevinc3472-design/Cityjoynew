import { normalizeEmail } from '../permissions/grants';
import type { Module } from '../permissions/types';

/**
 * Onay merkezi (PROJE.md 6.5, 6.7): onay gereken her iş önce il yöneticisinin, sonra admin'in onayından geçer.
 * Bu dosya veri yapısı ve kurallar; Firebase okuma/yazma `firebase/approvals.ts` içinde.
 */

/**
 * Onay gereken iş türleri. Şimdilik yalnızca işletme doğrulaması çalışıyor; diğerleri ilgili özellik yapılınca
 * açılır (veritabanı kuralları da yalnızca açılmış türleri kabul eder).
 * highRisk: toplu onaya girmez, her seferinde tek tek onaylanır (PROJE.md 6.5, standart güvenlik).
 */
export const APPROVAL_KINDS = {
  'isletme-dogrulama': { module: 'isletme-dogrulama', highRisk: false, live: true },
  'kampanya-bildirimi': { module: 'bildirimler', highRisk: false, live: false },
  'il-geneli-bildirim': { module: 'bildirimler', highRisk: true, live: false },
  'etkinlik-yetkisi': { module: 'etkinlikler', highRisk: false, live: false },
  'kulup-basvurusu': { module: 'kurumlar', highRisk: false, live: false },
  'yayinci-basvurusu': { module: 'kurumlar', highRisk: false, live: false },
  'yarisma-talebi': { module: 'etkinlikler', highRisk: false, live: false },
  'anket-yayini': { module: 'bildirimler', highRisk: false, live: false },
  'kurum-acma': { module: 'kurumlar', highRisk: true, live: false },
  'hesap-kapatma': { module: 'moderasyon', highRisk: true, live: false },
  'ucret-iade': { module: 'isletme-dogrulama', highRisk: true, live: false },
} as const satisfies Record<string, { module: Module; highRisk: boolean; live: boolean }>;

export type ApprovalKind = keyof typeof APPROVAL_KINDS;

/** Güvenilir yönetici listesinde seçilebilen kategoriler (iş türlerinin bölümleri). */
export const APPROVAL_MODULES: Module[] = [...new Set(Object.values(APPROVAL_KINDS).map((k) => k.module as Module))];

export type ApprovalStatus = 'il-onayi-bekliyor' | 'admin-onayi-bekliyor' | 'onaylandi' | 'reddedildi';

export const PENDING_STATUSES: ApprovalStatus[] = ['il-onayi-bekliyor', 'admin-onayi-bekliyor'];

export interface ApprovalStep {
  uid: string;
  /** Küçük harfli e-posta: güvenilir yönetici listesiyle eşleştirilir. */
  email: string;
  name: string;
  /** ISO tarih. */
  at: string;
}

export interface Approval {
  /** `${tür}__${hedef}`: aynı iş için ikinci bekleyen istek açılmaz. */
  id: string;
  kind: ApprovalKind;
  module: Module;
  /** Onaylanınca değişecek kaydın kimliği (örn. işletme). */
  targetId: string;
  /** Listede görünen kısa ad (örn. işletme adı). */
  title: string;
  region: { provinceCode: string; districtId?: string };
  status: ApprovalStatus;
  /** İsteyenin kimliği (ad ve e-posta yazılmaz). */
  requestedBy: string;
  requestedAt: string;
  note?: string;
  /** 1. aşama: il yöneticisinin onayı. Admin doğrudan onaylarsa boş kalır. */
  firstApproval?: ApprovalStep;
  /** Son karar (onay ya da ret). Retlerde gerekçe zorunlu. */
  decision?: { uid: string; at: string; stage: 1 | 2; reason?: string };
}

/**
 * Güvenilir yönetici (PROJE.md 6.5): ilk aşamada onayladığı iş bu il / ilçe / kategori içindeyse "güvenli" sayılır.
 * Kişi e-postasıyla tanınır; bir kişi için bölge başına bir kayıt.
 */
export interface TrustedApprover {
  id: string;
  email: string;
  displayName: string;
  provinceCode: string;
  /** Boşsa ilin tamamı. */
  districtId?: string;
  /** Boşsa bütün kategoriler. */
  modules: Module[];
  addedBy: string;
  addedAt: string;
  removedAt?: string;
}

export const approvalDocId = (kind: ApprovalKind, targetId: string) => `${kind}__${targetId}`;

export function trustedApproverDocId(email: string, provinceCode: string, districtId?: string) {
  return `${normalizeEmail(email)}__${districtId ? `ilce-${districtId}` : `il-${provinceCode}`}`;
}

export const isPending = (a: Pick<Approval, 'status'>) => PENDING_STATUSES.includes(a.status);

export const isHighRisk = (a: Pick<Approval, 'kind'>) => APPROVAL_KINDS[a.kind]?.highRisk ?? true;

/** İlk aşamayı onaylayan kişi, bu iş için güvenilir yönetici listesinde mi? */
export function isSafeApproval(a: Approval, trusted: TrustedApprover[]): boolean {
  if (a.status !== 'admin-onayi-bekliyor' || !a.firstApproval || isHighRisk(a)) return false;
  const email = normalizeEmail(a.firstApproval.email);
  return trusted.some(
    (t) =>
      !t.removedAt &&
      normalizeEmail(t.email) === email &&
      t.provinceCode === a.region.provinceCode &&
      (!t.districtId || t.districtId === a.region.districtId) &&
      (t.modules.length === 0 || t.modules.includes(a.module)),
  );
}

export interface ApprovalFilter {
  provinceCode?: string;
  districtId?: string;
  module?: Module;
  /** Hangi aşamadakiler; boşsa bekleyenlerin hepsi, "sonuclanan" onaylanan ve reddedilenler. */
  status?: ApprovalStatus | 'sonuclanan';
}

export function filterApprovals(list: Approval[], f: ApprovalFilter): Approval[] {
  return list.filter(
    (a) =>
      (!f.provinceCode || a.region.provinceCode === f.provinceCode) &&
      (!f.districtId || a.region.districtId === f.districtId) &&
      (!f.module || a.module === f.module) &&
      (f.status === 'sonuclanan' ? !isPending(a) : f.status ? a.status === f.status : isPending(a)),
  );
}

/**
 * Toplu onaya girecek işler: "Tümünü onayla" listede görünen bekleyenlerin hepsi, "Güvenli olanları onayla"
 * yalnızca güvenilir yöneticinin ilk aşamada onayladıkları. Yüksek riskli işler ikisine de girmez.
 */
export function bulkApprovable(list: Approval[], mode: 'tumu' | 'guvenli', trusted: TrustedApprover[] = []): Approval[] {
  return list.filter((a) => isPending(a) && !isHighRisk(a) && (mode === 'tumu' || isSafeApproval(a, trusted)));
}

export const REJECT_REASON_LIMITS = [5, 300] as const;
export const APPROVAL_NOTE_LIMIT = 300;

/** Ret gerekçesi zorunlu (PROJE.md 6.5); istek sahibine gösterilir. */
export function validRejectReason(reason: string): boolean {
  const n = reason.trim().length;
  return n >= REJECT_REASON_LIMITS[0] && n <= REJECT_REASON_LIMITS[1];
}
