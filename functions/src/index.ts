/**
 * CityJoy sunucu işlevleri (Firebase Cloud Functions; Blaze plan ister). İş mantığı ayrı dosyalarda, burada yalnızca
 * tetikleyiciler var; testler mantığı emülatördeki veritabanıyla doğrudan çağırır.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as functionsV1 from 'firebase-functions/v1';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { handleAnnouncementWrite, sendScheduledAnnouncements } from './announcements';
import { handleActivityChange, handleEventChange } from './cancellations';
import { deleteExpiredPushLog, deleteExpiredSos, deleteUserLeftovers } from './cleanup';
import { handleActivityCover, handleListingPhotos, handleMediaChange, handlePostPhotos, MEDIA_FIELDS, type DeleteFiles } from './photos';
import { expoSender } from './push';
import { handleFollowWrite, handleMessageCreate } from './social';

initializeApp();
const db = getFirestore();
const REGION = 'europe-west1';
// Maliyet sınırı: her işlevden aynı anda en çok 5 kopya.
setGlobalOptions({ region: REGION, maxInstances: 5 });

const deps = () => ({ send: expoSender, now: new Date() });
const deleteFiles: DeleteFiles = (prefix) => getStorage().bucket().deleteFiles({ prefix });

export const eventCancelled = onDocumentUpdated('events/{id}', async (e) => {
  await handleEventChange(db, e.params.id, e.data?.before.data(), e.data?.after.data(), deps());
});

export const activityCancelled = onDocumentUpdated('activities/{id}', async (e) => {
  await handleActivityChange(db, e.params.id, e.data?.before.data(), e.data?.after.data(), deps());
});

// Doğrudan yayınlanan duyuru oluşturulurken, onaylanan ise güncellenirken yayına girer.
export const announcementPublished = onDocumentWritten('announcements/{id}', async (e) => {
  await handleAnnouncementWrite(db, e.params.id, e.data?.before.data(), e.data?.after.data(), deps());
});

export const messageSent = onDocumentCreated('chats/{chatId}/messages/{mid}', async (e) => {
  await handleMessageCreate(db, e.params.chatId, e.data?.data(), deps());
});

export const followChanged = onDocumentWritten('follows/{fid}', async (e) => {
  await handleFollowWrite(db, e.params.fid, e.data?.before.data(), e.data?.after.data(), deps());
});

// Gönderi kaldırılınca fotoğraf dosyaları silinir.
export const postPhotosRemoved = onDocumentUpdated('posts/{id}', async (e) => {
  await handlePostPhotos(db, e.params.id, e.data?.before.data(), e.data?.after.data(), deleteFiles);
});

// Etkinlik kapağı, kurum logosu, işletme logosu ve vitrininden çıkan görsellerin dosyaları silinir.
export const eventMediaChanged = onDocumentWritten('events/{id}', async (e) => {
  await handleMediaChange(MEDIA_FIELDS.events, e.data?.before.data(), e.data?.after.data(), deleteFiles);
});
export const profileMediaChanged = onDocumentWritten('officialProfiles/{id}', async (e) => {
  await handleMediaChange(MEDIA_FIELDS.officialProfiles, e.data?.before.data(), e.data?.after.data(), deleteFiles);
});
// Profil fotoğrafı değişince, kaldırılınca ya da profil silinince (hesap silme) eski dosya silinir.
export const profilePhotoChanged = onDocumentWritten('publicProfiles/{uid}', async (e) => {
  await handleMediaChange(MEDIA_FIELDS.publicProfiles, e.data?.before.data(), e.data?.after.data(), deleteFiles);
});
export const businessMediaChanged = onDocumentWritten('businesses/{id}', async (e) => {
  await handleMediaChange(MEDIA_FIELDS.businesses, e.data?.before.data(), e.data?.after.data(), deleteFiles);
});

// Çarşı ilanından çıkan ya da ilan kaldırılınca fotoğraf dosyaları silinir.
export const listingPhotosChanged = onDocumentWritten('listings/{id}', async (e) => {
  await handleListingPhotos(db, e.params.id, e.data?.before.data(), e.data?.after.data(), deleteFiles);
});

// Seyahat içeriklerinden çıkan kapakların dosyaları silinir.
export const travelCoverChanged = Object.fromEntries(
  ['travelRegions', 'travelCities', 'travelPlaces', 'travelRoutes', 'travelLocal', 'travelMunicipal'].map((col) => [
    col,
    onDocumentWritten(`${col}/{id}`, async (e) => {
      await handleMediaChange(MEDIA_FIELDS.travel, e.data?.before.data(), e.data?.after.data(), deleteFiles);
    }),
  ]),
);

// Kaldırılan aktivitenin kapak dosyası silinir.
export const activityCoverChanged = onDocumentWritten('activities/{id}', async (e) => {
  await handleActivityCover(db, e.params.id, e.data?.before.data(), e.data?.after.data(), deleteFiles);
});

export const scheduledAnnouncements = onSchedule({ schedule: 'every 10 minutes', timeZone: 'Europe/Istanbul' }, async () => {
  await sendScheduledAnnouncements(db, deps());
});

export const dailyCleanup = onSchedule({ schedule: 'every day 04:00', timeZone: 'Europe/Istanbul' }, async () => {
  const now = new Date();
  await deleteExpiredSos(db, now);
  await deleteExpiredPushLog(db, now);
});

// Hesap silme tetikleyicisi yalnızca 1. kuşak işlevlerde var.
export const userDeleted = functionsV1
  .region(REGION)
  .auth.user()
  .onDelete((user) => deleteUserLeftovers(db, user.uid, deleteFiles));
