/** Panel rolleri (PROJE.md bölüm 6). Normal kullanıcı panele girmez. */
export type Role =
  | 'admin'
  | 'il-yoneticisi'
  | 'belediye'
  | 'baskan'
  | 'muhtar'
  | 'kurum'
  | 'kulup'
  | 'moderator'
  | 'yayinci';

/** Panelde yetki verilebilen bölümler. Yeni özellik eklendikçe buraya eklenir. */
export type Module =
  | 'konumlar'
  | 'meslekler'
  | 'acil-numaralar'
  | 'hizmet-kategorileri'
  | 'sos'
  | 'yetkiler'
  | 'onaylar'
  | 'islem-kayitlari'
  | 'bildirimler'
  | 'gonderiler'
  | 'etkinlikler'
  | 'hizmetler'
  | 'moderasyon'
  | 'isletme-dogrulama'
  | 'kurumlar'
  | 'sehir-rehberi';

export type Action = 'goruntule' | 'ekle' | 'duzenle' | 'sil' | 'onayla' | 'bildirim-gonder';

/** Bir yetkinin geçerli olduğu bölge. Üst bölge alttakileri kapsar (il > ilçe > mahalle). */
export type RegionScope =
  | { level: 'ulke' }
  | { level: 'il'; provinceCode: string }
  | { level: 'ilce'; provinceCode: string; districtId: string }
  | { level: 'mahalle'; provinceCode: string; districtId: string; neighbourhoodId: string };

/** İşlemin yapıldığı yer; bölgesiz işlemler (örn. rol tanımı) yalnızca ülke kapsamıyla yapılır. */
export interface RegionRef {
  provinceCode?: string;
  districtId?: string;
  neighbourhoodId?: string;
}

/**
 * Bir kişiye verilen yetki. Kişi e-postasıyla tanınır (PROJE.md 6.7): yetkiyi veren e-postayı yazar, kişi o
 * (doğrulanmış) e-postayla girince yetki açılır. Her atama ve geri alma işlem kaydına yazılır.
 */
export interface PermissionGrant {
  id: string;
  /** Küçük harfli e-posta. */
  email: string;
  role: Role;
  scope: RegionScope;
  modules: Partial<Record<Module, Action[]>>;
  grantedBy: string;
  /** ISO tarih. */
  grantedAt: string;
  /** Süreli yetkilerde bitiş (ISO tarih). */
  expiresAt?: string;
  revokedAt?: string;
  /** Kurum personeli görevinden türetilen yetkide kurum kimliği. */
  orgId?: string;
}

/** Yönetici işlem kaydı (kim, neyi, ne zaman). Silinemez, yalnızca eklenir. */
export interface AuditLogEntry {
  id: string;
  actorUid: string;
  module: Module;
  action: Action;
  targetId?: string;
  region?: RegionRef;
  /** ISO tarih. */
  at: string;
  /** Değişen alanların özeti; kişisel veri yazılmaz. */
  summary: string;
}
