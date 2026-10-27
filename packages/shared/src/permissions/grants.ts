import type { Organization, OrganizationMember, StaffRole } from '../organizations/types';
import type { Action, Module, PermissionGrant, RegionScope, Role } from './types';

type Caps = Partial<Record<Module, Action[]>>;

export const ALL_ACTIONS: Action[] = ['goruntule', 'ekle', 'duzenle', 'sil', 'onayla', 'bildirim-gonder'];

export const ALL_MODULES: Module[] = [
  'konumlar',
  'meslekler',
  'acil-numaralar',
  'hizmet-kategorileri',
  'sos',
  'kurumlar',
  'yetkiler',
  'onaylar',
  'islem-kayitlari',
  'bildirimler',
  'gonderiler',
  'etkinlikler',
  'hizmetler',
  'moderasyon',
  'isletme-dogrulama',
  'sehir-rehberi',
];

/** Kişiye (kurum dışı) verilen roller. Belediye, kurum, kulüp ve yayıncı kurum olarak açılır (PROJE.md 6.7). */
export const PERSON_ROLES = ['il-yoneticisi', 'muhtar', 'moderator'] as const;
export type PersonRole = (typeof PERSON_ROLES)[number];

/**
 * Her kişi rolüne verilebilecek en geniş yetki. Ülke geneli listeler (meslekler, acil numaralar, kategori ağacı,
 * SOS ayarları) ve kurum açma admin'de kalır. Veritabanı kuralları aynı sınırı ayrıca denetler.
 */
export const ROLE_CAPS: Record<PersonRole, Caps> = {
  'il-yoneticisi': {
    konumlar: ['goruntule'],
    'acil-numaralar': ['goruntule'],
    // "onayla" = eksik hizmet önerisini incelendi yapmak (kendi ilinde).
    'hizmet-kategorileri': ['goruntule', 'onayla'],
    // Kendi ilindeki kurumları görür; kurumu yalnızca admin açar.
    kurumlar: ['goruntule'],
    // Kendi ilinde muhtar ve gönüllü moderatör yetkisi verir, değiştirir, geri alır.
    yetkiler: ['goruntule', 'ekle', 'duzenle', 'sil'],
    onaylar: ['goruntule', 'onayla'],
    'islem-kayitlari': ['goruntule'],
    bildirimler: ['goruntule', 'ekle', 'duzenle', 'sil', 'bildirim-gonder'],
    gonderiler: ['goruntule', 'ekle', 'duzenle', 'sil', 'onayla'],
    etkinlikler: ['goruntule', 'ekle', 'duzenle', 'sil', 'onayla'],
    hizmetler: ['goruntule', 'ekle', 'duzenle', 'sil'],
    moderasyon: ['goruntule', 'duzenle', 'sil'],
    'isletme-dogrulama': ['goruntule', 'onayla'],
    // Benim Şehrim sabit bilgileri: Excel'den yükleme, düzenleme, doğrulama (kendi ilinde).
    'sehir-rehberi': ['goruntule', 'ekle', 'duzenle', 'sil', 'onayla'],
  },
  muhtar: {
    konumlar: ['goruntule'],
    'islem-kayitlari': ['goruntule'],
    gonderiler: ['goruntule', 'ekle', 'duzenle', 'sil'],
    etkinlikler: ['goruntule', 'ekle', 'duzenle'],
    bildirimler: ['goruntule', 'ekle', 'bildirim-gonder'],
  },
  moderator: {
    konumlar: ['goruntule'],
    'islem-kayitlari': ['goruntule'],
    moderasyon: ['goruntule', 'duzenle'],
  },
};

/** Kimin hangi rolü verebileceği (PROJE.md 6.7). Admin hepsini verir. */
export const DELEGABLE_ROLES: Record<'admin' | 'il-yoneticisi', PersonRole[]> = {
  admin: ['il-yoneticisi', 'muhtar', 'moderator'],
  'il-yoneticisi': ['muhtar', 'moderator'],
};

/** Her rolün hangi bölge düzeyinde verilebileceği. */
export const ROLE_SCOPE_LEVELS: Record<PersonRole, RegionScope['level'][]> = {
  'il-yoneticisi': ['il'],
  muhtar: ['mahalle'],
  moderator: ['il', 'ilce', 'mahalle'],
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

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Yetki belgesinin kimliği: kişi (e-posta) başına bölge başına bir yetki. Kimlik tahmin edilebilir olduğu için
 * veritabanı kuralları "bu kişinin Bursa yetkisi var mı?" sorusunu tek okumayla cevaplar.
 */
export function grantDocId(email: string, scope: RegionScope): string {
  return `${normalizeEmail(email)}__${scopeKey(scope)}`;
}

/** Boş eylem listelerini atar, eylemleri sabit sıraya dizer ve sınırın dışındakileri ayıklar. */
export function normalizeModules(modules: Caps, limit: Caps): Caps {
  const out: Caps = {};
  for (const m of ALL_MODULES) {
    const allowed = limit[m] ?? [];
    const actions = ALL_ACTIONS.filter((a) => modules[m]?.includes(a) && allowed.includes(a));
    // Görüntüleme yetkisi olmadan başka eylem anlamsızdır.
    if (actions.length && !actions.includes('goruntule') && allowed.includes('goruntule')) actions.unshift('goruntule');
    if (actions.length) out[m] = actions;
  }
  return out;
}

/** İki sınırın kesişimi: kimse kendinde olmayan yetkiyi veremez. */
export function intersectCaps(a: Caps, b: Caps): Caps {
  const out: Caps = {};
  for (const m of ALL_MODULES) {
    const both = (a[m] ?? []).filter((x) => (b[m] ?? []).includes(x));
    if (both.length) out[m] = both;
  }
  return out;
}

/** Yeni yetki formunun başlangıç değeri: rol şablonu, rolün sınırına göre süzülmüş. */
export function defaultModulesFor(role: PersonRole, templates: Record<Role, Caps>): Caps {
  return normalizeModules(templates[role], ROLE_CAPS[role]);
}

export type GrantState = 'aktif' | 'suresi-doldu' | 'geri-alindi';

export function grantState(grant: Pick<PermissionGrant, 'revokedAt' | 'expiresAt'>, now = new Date()): GrantState {
  if (grant.revokedAt) return 'geri-alindi';
  if (grant.expiresAt && new Date(grant.expiresAt) <= now) return 'suresi-doldu';
  return 'aktif';
}

/** Panelde gösterilen yetki kaydı: kime verildiğini tanımak için ad da tutulur. */
export interface GrantRecord extends PermissionGrant {
  role: PersonRole;
  displayName: string;
  note?: string;
  revokedBy?: string;
}

// ---- Kurumlar ----

/** Kuruma verilebilecek bölümler (kurumun içerik bölümleri). */
export const ORG_MODULES: Module[] = ['gonderiler', 'etkinlikler', 'bildirimler', 'hizmetler'];

/** Personel görevinin eylemleri (PROJE.md 6.6). "Onaysız yayınlayabilir" ayrı işarettir. */
export const STAFF_ACTIONS: Record<StaffRole, Action[]> = {
  izleyen: ['goruntule'],
  hazirlayan: ['goruntule', 'ekle', 'duzenle'],
  onaylayan: ['goruntule', 'ekle', 'duzenle', 'sil', 'onayla', 'bildirim-gonder'],
};

export function orgRole(kind: Organization['kind']): Role {
  if (kind === 'kulup' || kind === 'yayinci' || kind === 'kurum') return kind;
  return 'belediye';
}

/**
 * Kurum görevini panel yetkisine çevirir (menü ve ekrandaki düğmeler için; asıl denetim kurallarda).
 * Kurum yöneticisi kurumun bütün bölümlerini görür ve personel yönetir.
 */
export function membershipToGrant(org: Organization, member: OrganizationMember): PermissionGrant {
  const modules: Caps = { konumlar: ['goruntule'], 'islem-kayitlari': ['goruntule'] };
  for (const m of org.modules) {
    const a = member.assignments[m];
    if (a) modules[m] = STAFF_ACTIONS[a.role].filter((x) => m === 'bildirimler' || x !== 'bildirim-gonder');
    else if (member.isOrgAdmin) modules[m] = ['goruntule'];
  }
  if (member.isOrgAdmin) modules.kurumlar = ['goruntule', 'ekle', 'duzenle', 'sil'];
  return {
    id: `${org.id}__${member.email}`,
    email: member.email,
    role: orgRole(org.kind),
    scope: org.scope,
    modules,
    grantedBy: 'kurum',
    grantedAt: '',
    orgId: org.id,
    ...(member.expiresAt ? { expiresAt: member.expiresAt } : {}),
    ...(member.removedAt ? { revokedAt: member.removedAt } : {}),
  };
}
