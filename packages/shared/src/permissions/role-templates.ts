import type { Action, Module, Role } from './types';

const ALL: Action[] = ['goruntule', 'ekle', 'duzenle', 'sil', 'onayla', 'bildirim-gonder'];
const READ: Action[] = ['goruntule'];
const WRITE: Action[] = ['goruntule', 'ekle', 'duzenle'];

/**
 * Rol atanırken önerilen varsayılan yetkiler (öneri, PROJE.md bölüm 6). Admin atama sırasında
 * değiştirebilir; asıl geçerli olan PermissionGrant kaydıdır.
 */
export const ROLE_TEMPLATES: Record<Role, Partial<Record<Module, Action[]>>> = {
  admin: {
    konumlar: ALL,
    yetkiler: ALL,
    onaylar: ALL,
    'islem-kayitlari': READ,
    bildirimler: ALL,
    gonderiler: ALL,
    etkinlikler: ALL,
    hizmetler: ALL,
    moderasyon: ALL,
    'isletme-dogrulama': ALL,
  },
  'il-yoneticisi': {
    konumlar: READ,
    // Yetkiyi yalnızca admin verir; il yöneticisi görür ve talep açar (talep onay merkezine düşer).
    yetkiler: ['goruntule'],
    // İki aşamalı onayın ilk aşaması (PROJE.md 6.5).
    onaylar: ['goruntule', 'onayla'],
    'islem-kayitlari': READ,
    bildirimler: ['goruntule', 'ekle', 'bildirim-gonder'],
    etkinlikler: [...WRITE, 'onayla'],
    hizmetler: WRITE,
    moderasyon: ['goruntule', 'duzenle', 'sil'],
    'isletme-dogrulama': ['goruntule', 'onayla'],
  },
  belediye: {
    konumlar: READ,
    gonderiler: [...WRITE, 'sil'],
    etkinlikler: [...WRITE, 'sil'],
    hizmetler: WRITE,
    bildirimler: ['goruntule', 'ekle', 'bildirim-gonder'],
  },
  baskan: { gonderiler: WRITE, etkinlikler: READ },
  muhtar: { konumlar: READ, gonderiler: WRITE, bildirimler: ['goruntule', 'ekle', 'bildirim-gonder'] },
  kurum: { gonderiler: WRITE, etkinlikler: WRITE },
  kulup: { gonderiler: WRITE, etkinlikler: WRITE },
  moderator: { moderasyon: ['goruntule', 'duzenle'] },
  yayinci: { gonderiler: READ },
};
