import type { Firestore } from 'firebase/firestore';

import { createFirestoreActivityRepository } from './activities';
import { createFirestoreBusinessRepository } from './businesses';
import { createFirestoreEventRepository } from './events';
import { deleteUsageOf } from './limits';
import { createFirestoreListingRepository } from './listings';
import { createFirestoreMessageRepository } from './messages';
import { createNotificationSettings } from './notifications';
import { createFirestoreOfficialFollowRepository } from './official-follows';
import { createFirestorePostRepository } from './posts';
import { createFirestoreProfileRepository } from './profiles';
import { createFirestoreReviewRepository } from './reviews';
import { deleteServiceSuggestionsOf } from './service-categories';
import { createFirestoreSocialRepository } from './social';
import { createFirestoreFamilyRepository } from './sos';

/**
 * Hesap silinmeden önce kişinin bütün verisi (KVKK; Apple ve Google hesap silme şartı). Uygulamadaki Hesabı sil ve
 * web'deki hesap silme sayfası aynı sırayı kullanır: aile bağları, SOS kayıtları, etkinlik/aktivite katılımları ve
 * açtığı aktiviteler, mesajlar, bildirim tercihleri, Keşfet gönderileri, Çarşı ilanları, beğeni/takip/engel,
 * değerlendirmeler, işletme yetkileri, resmî hesap takipleri, işletmeleri, hizmet önerileri, sınır sayaçları ve en son
 * profil. Geride kalan dosyaları ve kayıtları sunucudaki userDeleted işlevi temizler.
 */
export async function deleteAllUserData(db: Firestore, uid: string): Promise<void> {
  await createFirestoreFamilyRepository(db).deleteAllOf(uid);
  // Etkinlik ve aktivite katılımları aynı adla tutulur, leaveAll ikisini de siler.
  await createFirestoreEventRepository(db).leaveAll(uid);
  await createFirestoreActivityRepository(db).deleteAllOf(uid);
  await createFirestoreMessageRepository(db).deleteAllOf(uid);
  await createNotificationSettings(db).delete(uid);
  await createFirestorePostRepository(db).deleteAllOf(uid);
  await createFirestoreListingRepository(db).deleteAllOf(uid);
  await createFirestoreSocialRepository(db).deleteAllOf(uid);
  await createFirestoreReviewRepository(db).deleteAllBy(uid);
  const businesses = createFirestoreBusinessRepository(db);
  await businesses.leaveAllOf(uid);
  await createFirestoreOfficialFollowRepository(db).leaveAllOf(uid);
  await businesses.deleteAllOf(uid);
  await deleteServiceSuggestionsOf(db, uid);
  await deleteUsageOf(db, uid);
  await createFirestoreProfileRepository(db).delete(uid);
}
