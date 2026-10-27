import type { Module, RegionScope } from '../permissions/types';

/** Panel kullanan kurum: belediye, muhtarlık, kurum, kulüp, yayıncı. Admin açar. */
export interface Organization {
  id: string;
  name: string;
  kind: 'buyuksehir-belediyesi' | 'ilce-belediyesi' | 'il-belediyesi' | 'muhtarlik' | 'kurum' | 'kulup' | 'yayinci';
  /** Admin'in kuruma verdiği bölge ve bölümler; personel bunların dışına çıkamaz. */
  scope: RegionScope;
  modules: Module[];
  createdBy: string;
  createdAt: string;
}

/** Kurum içi görev (PROJE.md 6.6). Bölüm başına ayrı verilir. */
export type StaffRole = 'hazirlayan' | 'onaylayan' | 'izleyen';

export interface StaffAssignment {
  role: StaffRole;
  /** Onay beklemeden yayınlayabilir (örn. acil duyuru). */
  canPublishDirectly?: boolean;
}

export interface OrganizationMember {
  orgId: string;
  uid: string;
  displayName: string;
  /** Kurum yöneticisi personel ekler, çıkarır ve görev verir. */
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
