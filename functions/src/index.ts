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
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { handleAnnouncementWrite } from './announcements';
import { handleBusinessPostWrite } from './business-posts';
import { cloudBillingDisabler, handleBudgetNotice, handleManualStop, type BudgetNotice } from './budget';
import { handleActivityChange, handleEventChange } from './cancellations';
import { deleteExpiredPushLog, deleteExpiredSos, deleteUserLeftovers } from './cleanup';
import { handleActivityCover, handleListingPhotos, handleMediaChange, handlePostPhotos, MEDIA_FIELDS, type DeleteFiles } from './photos';
import { expoSender } from './push';
import { handleFollowWrite, handleMessageCreate } from './social';
import { deleteOldTranslations, googleTranslator, handleTranslate, TranslateError } from './translate';

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

// İşletme adına yayındaki gönderi sayısı (Ücretsiz kademede toplam sınır).
export const businessPostCounted = onDocumentWritten('posts/{id}', async (e) => {
  await handleBusinessPostWrite(db, e.data?.before.data(), e.data?.after.data());
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

export const dailyCleanup = onSchedule({ schedule: 'every day 04:00', timeZone: 'Europe/Istanbul' }, async () => {
  const now = new Date();
  await deleteExpiredSos(db, now);
  await deleteExpiredPushLog(db, now);
  await deleteOldTranslations(db, now);
});

// "Çevir" düğmesi: yalnızca giriş yapmış kişi; sınır ve önbellek translate.ts'de.
export const translate = onCall({ maxInstances: 5 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'giris');
  const data = (req.data ?? {}) as { text?: unknown; target?: unknown };
  try {
    return await handleTranslate(db, googleTranslator, req.auth.uid, data.text, data.target, new Date());
  } catch (e) {
    if (!(e instanceof TranslateError)) throw e;
    const code = e.code === 'sinir' ? 'resource-exhausted' : e.code === 'gecersiz' ? 'invalid-argument' : 'unavailable';
    throw new HttpsError(code, e.code, e.resetAt ? { resetAt: e.resetAt } : undefined);
  }
});

// Harcama sigortası: bütçe bildirimi gelir, harcama sigorta tutarına ulaşırsa ödeme bağlantısı koparılır (budget.ts).
const PROJECT = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? '';
export const budgetGuard = onMessagePublished({ topic: 'budget-alerts', maxInstances: 1 }, async (e) => {
  const notice = (e.data.message.json ?? {}) as BudgetNotice;
  if (await handleBudgetNotice(db, notice, cloudBillingDisabler(PROJECT), new Date())) console.warn('Harcama sigortası attı', notice);
});

// Panel > Harcama > "Şimdi durdur" (yalnızca admin).
export const billingStop = onCall({ maxInstances: 1 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'giris');
  try {
    await handleManualStop(db, req.auth.uid, cloudBillingDisabler(PROJECT), new Date());
    return { stopped: true };
  } catch (e) {
    if (e instanceof Error && e.message === 'yetki') throw new HttpsError('permission-denied', 'yetki');
    throw new HttpsError('internal', 'durdurulamadi');
  }
});

// Hesap silme tetikleyicisi yalnızca 1. kuşak işlevlerde var.
export const userDeleted = functionsV1
  .region(REGION)
  .auth.user()
  .onDelete((user) => deleteUserLeftovers(db, user.uid, deleteFiles));
