import type { Action, Module, Role } from './types';

const ALL: Action[] = ['goruntule', 'ekle', 'duzenle', 'sil', 'onayla', 'yayinla', 'bildirim-gonder'];
const READ: Action[] = ['goruntule'];
const WRITE: Action[] = ['goruntule', 'ekle', 'duzenle'];

/**
 * Rol atanırken önerilen varsayılan yetkiler (öneri, PROJE.md bölüm 6). Admin atama sırasında
 * değiştirebilir; asıl geçerli olan PermissionGrant kaydıdır.
 */
export const ROLE_TEMPLATES: Record<Role, Partial<Record<Module, Action[]>>> = {
  admin: {
    konumlar: ALL,
    meslekler: ALL,
    'acil-numaralar': ALL,
    'hizmet-kategorileri': ALL,
    // Yalnızca ayarlar; kişilerin SOS kayıtları ve konumları panelde görünmez (gizlilik).
    sos: ALL,
    yetkiler: ALL,
    kurumlar: ALL,
    'sehir-rehberi': ALL,
    onaylar: ALL,
    'islem-kayitlari': READ,
    bildirimler: ALL,
    gonderiler: ALL,
    etkinlikler: ALL,
    hizmetler: ALL,
    moderasyon: ALL,
    'isletme-dogrulama': ALL,
    seyahat: ALL,
  },
  'il-yoneticisi': {
    konumlar: READ,
    // Acil numaralar ülke genelinde ortaktır; yalnızca admin değiştirir.
    'acil-numaralar': READ,
    // Kategori ağacı ülke geneli; değişikliği admin yapar. Kendi ilinin eksik hizmet önerilerini görür ve
    // "incelendi" yapar (onayla).
    'hizmet-kategorileri': ['goruntule', 'onayla'],
    // Kendi ilinde muhtar ve gönüllü moderatör yetkisi verir (PROJE.md 6.7); kurumları görür.
    yetkiler: ['goruntule', 'ekle', 'duzenle', 'sil'],
    kurumlar: READ,
    'sehir-rehberi': [...WRITE, 'sil', 'onayla'],
    // Kendi gönderi ve etkinliğini onaysız yayınlar; il geneli bildirim admin onayına gider (PROJE.md 6.7).
    gonderiler: [...WRITE, 'sil', 'onayla', 'yayinla'],
    // İki aşamalı onayın ilk aşaması (PROJE.md 6.5).
    onaylar: ['goruntule', 'onayla'],
    'islem-kayitlari': READ,
    bildirimler: ['goruntule', 'ekle', 'bildirim-gonder'],
    etkinlikler: [...WRITE, 'onayla', 'yayinla'],
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
