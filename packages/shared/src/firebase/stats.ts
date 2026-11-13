import {
  collection,
  getCountFromServer,
  query,
  Timestamp,
  where,
  type Firestore,
  type QueryConstraint,
} from './metered';

import { PENDING_STATUSES } from '../approvals/approvals';

/** Zaman aralığı (başlangıç dahil, bitiş hariç). */
export interface StatsRange {
  from?: Date;
  to?: Date;
}

/**
 * Panel istatistikleri (PROJE.md 6.1). Belge indirmeden yalnızca sayım yapılır (1.000 belge başına 1 okuma).
 * İl verilmezse tüm ülke sayılır; bu yalnızca ülke yetkisinde kurallardan geçer. Yetki yetmezse sonuç null olur,
 * panel o kutuyu "—" gösterir.
 */
export function createFirebaseStats(db: Firestore) {
  const count = async (path: string, constraints: QueryConstraint[]): Promise<number | null> => {
    try {
      return (await getCountFromServer(query(collection(db, path), ...constraints))).data().count;
    } catch {
      return null;
    }
  };
  const range = (field: string, r: StatsRange): QueryConstraint[] => [
    ...(r.from ? [where(field, '>=', Timestamp.fromDate(r.from))] : []),
    ...(r.to ? [where(field, '<', Timestamp.fromDate(r.to))] : []),
  ];

  return {
    /** Keşfet gönderileri (kaldırılanlar dahil, paylaşım hacmini gösterir). */
    posts(provinceCode: string, r: StatsRange = {}, category?: string) {
      return count('posts', [
        ...(provinceCode ? [where('region.provinceCode', '==', provinceCode)] : []),
        ...(category ? [where('category', '==', category)] : []),
        ...range('createdAt', r),
      ]);
    },

    /** İşletmeler; doğrulanmış olanlar ayrıca sayılabilir. */
    businesses(provinceCode: string, r: StatsRange = {}, verifiedOnly = false) {
      return count('businesses', [
        ...(provinceCode ? [where('location.provinceCode', '==', provinceCode)] : []),
        ...(verifiedOnly ? [where('verification.status', '==', 'dogrulandi')] : []),
        ...range('createdAt', r),
      ]);
    },

    /** İncelenmeyi bekleyen gönderi ve yorum şikâyetleri. */
    async openReports(provinceCode: string) {
      const scoped = provinceCode ? [where('provinceCode', '==', provinceCode)] : [];
      const [posts, comments] = await Promise.all([
        count('postReports', [...scoped, where('status', '==', 'yeni')]),
        count('commentReports', [...scoped, where('status', '==', 'yeni')]),
      ]);
      return posts === null && comments === null ? null : (posts ?? 0) + (comments ?? 0);
    },

    /** Onay bekleyen istekler (işletme doğrulama vb.). */
    pendingApprovals(provinceCode: string) {
      return count('approvals', [
        ...(provinceCode ? [where('region.provinceCode', '==', provinceCode)] : []),
        where('status', 'in', PENDING_STATUSES),
      ]);
    },

    /** Uygulamada profili olan kişi sayısı (yalnızca ülke geneli; profilde il tutulmaz). */
    profiles() {
      return count('publicProfiles', []);
    },
  };
}

export type FirebaseStats = ReturnType<typeof createFirebaseStats>;
