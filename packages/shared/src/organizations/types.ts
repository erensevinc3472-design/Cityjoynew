import type { Action, Module, RegionScope } from '../permissions/types';

export type OrganizationKind =
  | 'buyuksehir-belediyesi'
  | 'il-belediyesi'
  | 'ilce-belediyesi'
  | 'kurum'
  | 'kulup'
  | 'yayinci';

/**
 * Panel kullanan kurum: belediye, kamu kurumu, kulüp, yayıncı. Yalnızca admin açar (PROJE.md 6.7). Belediyelerin
 * kimliği kilitli ad listesindeki kimliktir ("bld-16-nilufer"), böylece aynı belediye iki kez açılamaz.
 */
export interface Organization {
  id: string;
  name: string;
  kind: OrganizationKind;
  /** Admin'in kuruma verdiği bölge ve bölümler; personel bunların dışına çıkamaz. */
  scope: RegionScope;
  modules: Module[];
  /** Kurumun resmî e-postası (hesap bununla açılır, şifre belirleme bağlantısı buraya gider). */
  officialEmail: string;
  status: 'aktif' | 'pasif';
  /** Sözleşme bitişi (ISO tarih); geçince kurum paneli kendiliğinden kapanır. */
  contractEndsAt?: string;
  createdBy: string;
  createdAt: string;
}

/**
 * Kurum içi görev (PROJE.md 6.6): bölüm başına işaretlenen eylemler. Örnekler: hazırlayan = görüntüle + ekle +
 * düzenle; onaylayan = bunlara ek onayla; "onaysız yayınla" (yayinla) işaretli kişi hazırladığını onay beklemeden yayınlar.
 */
export type StaffAssignment = Action[];

export interface OrganizationMember {
  orgId: string;
  /** Küçük harfli e-posta; kişi bu (doğrulanmış) e-postayla girince görevi açılır. */
  email: string;
  displayName: string;
  /** Kurum yöneticisi personel ekler, çıkarır ve görev verir. Yalnızca admin atar. */
  isOrgAdmin: boolean;
  assignments: Partial<Record<Module, StaffAssignment>>;
  /** Süreli görevlerde bitiş (ISO tarih). */
  expiresAt?: string;
  removedAt?: string;
}

/** Kurum içeriğinin durumu: taslak > onay bekliyor > (reddedildi | yayında). */
export type ContentStatus = 'taslak' | 'onay-bekliyor' | 'reddedildi' | 'yayinda';

export interface ContentReview {
  status: ContentStatus;
  preparedBy: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  /** Ret gerekçesi (zorunlu). */
  rejectionNote?: string;
}
