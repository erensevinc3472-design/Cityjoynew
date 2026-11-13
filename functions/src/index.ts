/**
 * CityJoy sunucu işlevleri (Firebase Cloud Functions; Blaze plan ister). İş mantığı ayrı dosyalarda, burada yalnızca
 * tetikleyiciler var; testler mantığı emülatördeki veritabanıyla doğrudan çağırır.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as functionsV1 from 'firebase-functions/v1';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onObjectFinalized } from 'firebase-functions/v2/storage';

import { handleAnnouncementWrite } from './announcements';
import { BroadcastError, handleBroadcastEstimate, handleBroadcastReview, handleBroadcastSend, type Actor } from './broadcasts';
import { handleBusinessPostWrite } from './business-posts';
import { cloudBillingDisabler, handleBudgetNotice, handleManualStop, type BudgetNotice } from './budget';
import { handleActivityChange, handleEventChange } from './cancellations';
import { deleteExpiredPushLog, deleteExpiredSos, deleteExpiredViewLog, deleteUserLeftovers } from './cleanup';
import { handleActivityCover, handleListingPhotos, handleMediaChange, handlePostPhotos, MEDIA_FIELDS, type DeleteFiles } from './photos';
import { expoSender } from './push';
import { handlePostTags, handleRecordViews, removeTagsOf, ViewError } from './post-tags';
import { expireMemberships } from './memberships';
import { handleFollowWrite, handleMessageCreate } from './social';
import { handleLift, handleSuspend, liftExpiredSuspensions, SuspensionError, type AccountSwitch } from './suspensions';
import { handleBusinessLift, handleBusinessSuspend, liftExpiredBusinessSuspensions } from './business-suspensions';
import { handleThumb } from './thumbs';
import { handleBusinessTierChange, handleTierVisibilityChoice, remindProEnding, TierVisibilityError } from './tier-visibility';
import { deleteOldTranslations, googleTranslator, handleTranslate, TranslateError } from './translate';
import { metFetchJson, refreshWeather, saveWeatherStatus } from './weather';

initializeApp();
const db = getFirestore();
const REGION = 'europe-west1';
// Maliyet sınırı: her işlevden aynı anda en çok 5 kopya.
setGlobalOptions({ region: REGION, maxInstances: 5 });

const deps = () => ({ send: expoSender, now: new Date() });
// Asıl dosyalar silinirken listelerde gösterilen küçük kopyaları da (`thumbs/`) silinir.
const deleteFiles: DeleteFiles = async (prefix) => {
  const bucket = getStorage().bucket();
  await Promise.all([bucket.deleteFiles({ prefix }), bucket.deleteFiles({ prefix: `thumbs/${prefix}` })]);
};

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

// Etiket isteği denetlenir, uygunlar yazılır ve bildirim gider (post-tags.ts).
export const postTagged = onDocumentCreated('posts/{id}', async (e) => {
  await handlePostTags(db, e.params.id, e.data?.data(), deps());
});

// Video izlenmeleri: telefon toplu gönderir, kişi başına günde bir sayılır.
export const recordViews = onCall({ maxInstances: 5 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'giris');
  try {
    return { counted: await handleRecordViews(db, req.auth.uid, req.data, new Date()) };
  } catch (e) {
    if (e instanceof ViewError) throw new HttpsError('invalid-argument', e.code);
    throw new HttpsError('internal', 'yapilamadi');
  }
});

// İşletme adına yayındaki gönderi sayısı (Ücretsiz kademede toplam sınır).
export const businessPostCounted = onDocumentWritten('posts/{id}', async (e) => {
  await handleBusinessPostWrite(db, e.data?.before.data(), e.data?.after.data());
});

// Yüklenen her fotoğrafın listelerde gösterilecek küçük kopyası (640 piksel) çıkarılır; maliyeti ve yüklenme süresini düşürür.
export const photoThumbnail = onObjectFinalized({ memory: '512MiB', maxInstances: 3 }, async (e) => {
  const { name, contentType, metadata } = e.data;
  const bucket = getStorage().bucket(e.data.bucket);
  await handleThumb(name, contentType, metadata?.firebaseStorageDownloadTokens, {
    read: async (n) => (await bucket.file(n).download())[0],
    write: (n, data, token) =>
      bucket.file(n).save(data, {
        resumable: false,
        contentType: 'image/jpeg',
        metadata: { cacheControl: 'public, max-age=31536000', ...(token ? { metadata: { firebaseStorageDownloadTokens: token } } : {}) },
      }),
  });
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
  // Pro açılınca ya da kapanınca fazla gönderiler gizlenir / geri gelir (hiçbiri silinmez).
  await handleBusinessTierChange(db, e.params.id, e.data?.before.data(), e.data?.after.data());
});

// Ücretsiz kademede hangi gönderinin görüneceğini işletme sahibi seçer.
export const choosePostVisibility = onCall({ maxInstances: 3 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'giris');
  try {
    await handleTierVisibilityChoice(db, req.auth.uid, req.data);
    return { ok: true };
  } catch (e) {
    if (!(e instanceof TierVisibilityError)) throw new HttpsError('internal', 'yapilamadi');
    throw new HttpsError(e.code === 'yetki' ? 'permission-denied' : e.code === 'yok' ? 'not-found' : e.code === 'pro' ? 'failed-precondition' : 'invalid-argument', e.code);
  }
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

// Sponsordan çıkan logo dosyası silinir.
export const sponsorLogoChanged = onDocumentWritten('sponsors/{id}', async (e) => {
  await handleMediaChange(MEDIA_FIELDS.sponsors, e.data?.before.data(), e.data?.after.data(), deleteFiles);
});

// Kaldırılan aktivitenin kapak dosyası silinir.
export const activityCoverChanged = onDocumentWritten('activities/{id}', async (e) => {
  await handleActivityCover(db, e.params.id, e.data?.before.data(), e.data?.after.data(), deleteFiles);
});

export const dailyCleanup = onSchedule({ schedule: 'every day 04:00', timeZone: 'Europe/Istanbul' }, async () => {
  const now = new Date();
  await deleteExpiredSos(db, now);
  await deleteExpiredPushLog(db, now);
  await deleteExpiredViewLog(db, now);
  await deleteOldTranslations(db, now);
  await expireMemberships(db, now);
  await remindProEnding(db, { send: expoSender, now });
});

// Hava durumu (Eren, 13 Kasım 2026): 3 saatte bir 81 il merkezi MET Norway'den bir kez çekilir, il başına küçük
// dosya yazılır; telefon yalnızca dosyayı okur (kullanıcı sayısı dış isteği artırmaz). Dosya 30 dakika önbellekte kalır.
export const weatherRefresh = onSchedule({ schedule: 'every 3 hours', timeZone: 'Europe/Istanbul', maxInstances: 1, timeoutSeconds: 300 }, async () => {
  const now = new Date();
  const bucket = getStorage().bucket();
  const run = await refreshWeather({
    now,
    fetchJson: metFetchJson,
    write: (path, file) =>
      bucket.file(path).save(JSON.stringify(file), { resumable: false, contentType: 'application/json', metadata: { cacheControl: 'public, max-age=1800' } }),
  });
  await saveWeatherStatus(db, run, now);
});

// Hesap askıya alma (yalnızca admin, panelden): giriş kapanır, açık oturumlar düşer.
const accounts: AccountSwitch = {
  disable: async (uid) => {
    await getAuth().updateUser(uid, { disabled: true });
    await getAuth().revokeRefreshTokens(uid);
  },
  enable: async (uid) => {
    await getAuth().updateUser(uid, { disabled: false });
  },
};
const suspensionCall = async (fn: () => Promise<void>) => {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    if (!(e instanceof SuspensionError)) throw new HttpsError('internal', 'yapilamadi');
    const code = e.code === 'yetki' ? 'permission-denied' : e.code === 'yok' ? 'not-found' : e.code === 'admin' ? 'failed-precondition' : 'invalid-argument';
    throw new HttpsError(code, e.code);
  }
};
export const suspendAccount = onCall({ maxInstances: 2 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'giris');
  return suspensionCall(() => handleSuspend(db, accounts, req.auth!.uid, req.data, new Date()));
});
export const liftSuspension = onCall({ maxInstances: 2 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'giris');
  return suspensionCall(() => handleLift(db, accounts, req.auth!.uid, (req.data as { uid?: unknown } | null)?.uid, new Date()));
});
// Bölgeye toplu bildirim (panel): ulaşılacak kişi sayısı, gönderme, il geneli için admin onayı.
const broadcastCall = async <T>(fn: () => Promise<T>) => {
  try {
    return await fn();
  } catch (e) {
    if (!(e instanceof BroadcastError)) throw new HttpsError('internal', 'yapilamadi');
    const code = e.code === 'yetki' ? 'permission-denied' : e.code === 'yok' ? 'not-found' : e.code === 'sinir' ? 'resource-exhausted' : 'invalid-argument';
    throw new HttpsError(code, e.code);
  }
};
const actorOf = (auth: { uid: string; token: { email?: string; email_verified?: boolean } }): Actor => ({
  uid: auth.uid,
  email: auth.token.email,
  emailVerified: auth.token.email_verified === true,
});
export const broadcastEstimate = onCall({ maxInstances: 2 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'giris');
  return broadcastCall(() => handleBroadcastEstimate(db, actorOf(req.auth!), req.data, new Date()));
});
export const broadcastSend = onCall({ maxInstances: 2, timeoutSeconds: 300 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'giris');
  return broadcastCall(() => handleBroadcastSend(db, actorOf(req.auth!), req.data, deps()));
});
export const broadcastReview = onCall({ maxInstances: 2, timeoutSeconds: 300 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'giris');
  return broadcastCall(async () => {
    await handleBroadcastReview(db, req.auth!.uid, req.data, deps());
    return { ok: true };
  });
});
// Süreli askılar saatte bir denetlenir (askı yoksa tek okuma).
export const suspensionExpiry = onSchedule({ schedule: 'every 1 hours', maxInstances: 1 }, async () => {
  await liftExpiredSuspensions(db, accounts, new Date());
  await liftExpiredBusinessSuspensions(db, new Date());
});
export const suspendBusiness = onCall({ maxInstances: 2 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'giris');
  return suspensionCall(() => handleBusinessSuspend(db, req.auth!.uid, req.data, new Date()));
});
export const liftBusinessSuspension = onCall({ maxInstances: 2 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'giris');
  return suspensionCall(() => handleBusinessLift(db, req.auth!.uid, (req.data as { businessId?: unknown } | null)?.businessId, new Date()));
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
  .onDelete(async (user) => {
    await deleteUserLeftovers(db, user.uid, deleteFiles);
    await removeTagsOf(db, user.uid);
  });

// Pro abonelik mağaza bildirimi (RevenueCat): store-webhook.ts. Ödeme ilk sürümde yok (PROJE.md 15.2); gizli
// bilgiler (REVENUECAT_WEBHOOK_AUTH, REVENUECAT_API_KEY) Secret Manager'a girilince aşağıdaki satır açılır. Kapalıyken
// Firebase yükleme sırasında bu gizli bilgileri istemez.
// export { storeEvents } from './store-webhook';
