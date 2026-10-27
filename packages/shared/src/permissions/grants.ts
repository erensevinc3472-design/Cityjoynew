import type { Action, Module, PermissionGrant, RegionScope, Role } from './types';

export const ALL_ACTIONS: Action[] = ['goruntule', 'ekle', 'duzenle', 'sil', 'onayla', 'bildirim-gonder'];

export const ALL_MODULES: Module[] = [
  'konumlar',
  'meslekler',
  'acil-numaralar',
  'hizmet-kategorileri',
  'sos',
  'yetkiler',
  'onaylar',
  'islem-kayitlari',
  'bildirimler',
  'gonderiler',
  'etkinlikler',
  'hizmetler',
  'moderasyon',
  'isletme-dogrulama',
];

/**
 * Admin olmayan bir role verilebilecek en geniş yetki. Ülke geneli listeler (meslekler, acil numaralar,
 * kategori ağacı, SOS ayarları) ve yetki verme yalnızca admin'de kalır (PROJE.md 6). Veritabanı kuralları
 * aynı sınırı ayrıca denetler.
 */
export const GRANTABLE_ACTIONS: Partial<Record<Module, Action[]>> = {
  konumlar: ['goruntule'],
  'acil-numaralar': ['goruntule'],
  // "onayla" = eksik hizmet önerisini incelendi yapmak (kendi ilinde).
  'hizmet-kategorileri': ['goruntule', 'onayla'],
  yetkiler: ['goruntule'],
  onaylar: ['goruntule', 'onayla'],
  'islem-kayitlari': ['goruntule'],
  bildirimler: ['goruntule', 'ekle', 'duzenle', 'sil', 'bildirim-gonder'],
  gonderiler: ['goruntule', 'ekle', 'duzenle', 'sil', 'onayla'],
  etkinlikler: ['goruntule', 'ekle', 'duzenle', 'sil', 'onayla'],
  hizmetler: ['goruntule', 'ekle', 'duzenle', 'sil'],
  moderasyon: ['goruntule', 'duzenle', 'sil'],
  'isletme-dogrulama': ['goruntule', 'onayla'],
};

/** Panelden verilebilen roller. Yeni admin şimdilik yalnızca Firebase konsolundan eklenir (güvenlik). */
export const ASSIGNABLE_ROLES: Exclude<Role, 'admin'>[] = [
  'il-yoneticisi',
  'belediye',
  'baskan',
  'muhtar',
  'kurum',
  'kulup',
  'moderator',
  'yayinci',
];

/** Her rolün hangi bölge düzeyinde verilebileceği (örn. il yöneticisi yalnızca il, muhtar yalnızca mahalle). */
export const ROLE_SCOPE_LEVELS: Record<Role, RegionScope['level'][]> = {
  admin: ['ulke'],
  'il-yoneticisi': ['il'],
  belediye: ['il', 'ilce'],
  baskan: ['il', 'ilce'],
  muhtar: ['mahalle'],
  kurum: ['ulke', 'il', 'ilce', 'mahalle'],
  kulup: ['il', 'ilce'],
  moderator: ['il', 'ilce', 'mahalle'],
  yayinci: ['ulke', 'il', 'ilce'],
};

/** Bölgenin kısa anahtarı: "ulke", "il-16", "ilce-16-nilufer", "mahalle-16-nilufer-ataevler". */
export function scopeKey(scope: RegionScope): string {
  switch (scope.level) {
    case 'ulke':
      return 'ulke';
    case 'il':
      return `il-${scope.provinceCode}`;
    case 'ilce':
      return `ilce-${scope.districtId}`;
    case 'mahalle':
      return `mahalle-${scope.neighbourhoodId}`;
  }
}

/**
 * Yetki belgesinin kimliği: kişi başına bölge başına bir yetki. Kimlik tahmin edilebilir olduğu için
 * veritabanı kuralları "bu kişinin Bursa yetkisi var mı?" sorusunu tek okumayla cevaplar.
 */
export function grantDocId(uid: string, scope: RegionScope): string {
  return `${uid}__${scopeKey(scope)}`;
}

/** Boş eylem listelerini atar, eylemleri sabit sıraya dizer ve verilebilir sınırın dışındakileri ayıklar. */
export function normalizeModules(
  modules: Partial<Record<Module, Action[]>>,
  limit: Partial<Record<Module, Action[]>> = GRANTABLE_ACTIONS,
): Partial<Record<Module, Action[]>> {
  const out: Partial<Record<Module, Action[]>> = {};
  for (const m of ALL_MODULES) {
    const allowed = limit[m] ?? [];
    const actions = ALL_ACTIONS.filter((a) => modules[m]?.includes(a) && allowed.includes(a));
    // Görüntüleme yetkisi olmadan başka eylem anlamsızdır.
    if (actions.length && !actions.includes('goruntule')) actions.unshift('goruntule');
    if (actions.length) out[m] = actions;
  }
  return out;
}

/** Rol şablonunu verilebilir sınıra göre süzer (yeni yetki formunun başlangıç değeri). */
export function defaultModulesFor(role: Role, templates: Record<Role, Partial<Record<Module, Action[]>>>) {
  return normalizeModules(templates[role]);
}

export type GrantState = 'aktif' | 'suresi-doldu' | 'geri-alindi';

export function grantState(grant: PermissionGrant, now = new Date()): GrantState {
  if (grant.revokedAt) return 'geri-alindi';
  if (grant.expiresAt && new Date(grant.expiresAt) <= now) return 'suresi-doldu';
  return 'aktif';
}

/** Panele giriş yapan ama yetkisi olmayan kişinin admin'e gönderdiği talep (kişi başına bir). */
export interface AccessRequest {
  uid: string;
  displayName: string;
  email: string;
  /** Kişinin yazdığı açıklama: kurum, görev, bölge. */
  note: string;
  status: 'yeni' | 'yetki-verildi' | 'reddedildi';
  /** ISO tarih. */
  createdAt: string;
}

/** Panelde gösterilen yetki kaydı: kime verildiğini tanımak için ad ve e-posta da tutulur. */
export interface GrantRecord extends PermissionGrant {
  displayName: string;
  email?: string;
  note?: string;
  revokedBy?: string;
}
