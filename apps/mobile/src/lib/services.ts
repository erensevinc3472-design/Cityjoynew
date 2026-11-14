import { createCityGuideStore, createEmergencyNumberStore, createServiceCategoryStore } from '@cityjoy/shared';
import {
  createFirebaseAuthService,
  createFirestoreAnnouncementRepository,
  createFirestoreEventRepository,
  createFirestoreOfficialProfileRepository,
  createFirestoreOfficialFollowRepository,
  createFirestoreActivityRepository,
  createFirestoreShowcaseRepository,
  createFirestoreDealRepository,
  createNeedsConfig,
  createFirestoreCommunityRepository,
  createHolidayRepository,
  createSponsorRepository,
  createOwnerPayments,
  createPostVisibility,
  createFirestoreTravelRepository,
  createFirestorePostRepository,
  createFirestoreSocialRepository,
  createBadgeReader,
  createFirestoreMessageRepository,
  createFirestoreListingRepository,
  createFirestoreCityGuideRepository,
  createFirestoreBusinessRepository,
  createRoadsidePackRepository,
  createFirestoreFamilyRepository,
  createFirestorePushTokenRepository,
  createFirestoreSosRepository,
  createFirestoreEmergencyNumberRepository,
  createFirestoreOccupationRepository,
  createFirestoreProfileRepository,
  createFirestoreReviewRepository,
  createFirestoreServiceCategoryRepository,
  createVerificationRequests,
  submitServiceSuggestion,
} from '@cityjoy/shared/firebase';
import { Platform } from 'react-native';

export { DuplicateBusinessError, SosSendTimeoutError } from '@cityjoy/shared/firebase';

import { firebaseAuth, firestore, functions } from './firebase';
import i18n from './i18n';
import { deviceStorage } from './storage';

// E-posta bağlantısından sonra "Devam" uygulamaya dönüş sayfasına gider (panel barındırmasında, 5 dil).
const webHost = firebaseAuth.app.options.projectId;
export const authService = createFirebaseAuthService(firebaseAuth, {
  languageCode: () => i18n.language,
  continueUrl: () =>
    webHost && !webHost.startsWith('demo-') && process.env.EXPO_PUBLIC_FIREBASE_EMULATOR !== '1'
      ? `https://${webHost}.web.app/uygulama.html?lang=${encodeURIComponent(i18n.language)}`
      : undefined,
});
export const profileRepository = createFirestoreProfileRepository(firestore);
export const occupationRepository = createFirestoreOccupationRepository(firestore);
export const emergencyNumbers = createEmergencyNumberStore(createFirestoreEmergencyNumberRepository(firestore), deviceStorage);
export const businessRepository = createFirestoreBusinessRepository(firestore);
export const roadsidePackRepository = createRoadsidePackRepository(firestore);
export const reviewRepository = createFirestoreReviewRepository(firestore);
export const announcementRepository = createFirestoreAnnouncementRepository(firestore);
export const eventRepository = createFirestoreEventRepository(firestore);
/** Kurum ve muhtarlık künyeleri (herkese açık). */
export const officialProfileRepository = createFirestoreOfficialProfileRepository(firestore);
/** Resmî profil takibi (kitle istatistiği isimsiz, toplu sayılır). */
export const officialFollowRepository = createFirestoreOfficialFollowRepository(firestore);
/** Kullanıcı aktiviteleri (tam buluşma yeri yalnızca düzenleyene ve katılanlara). */
export const activityRepository = createFirestoreActivityRepository(firestore);
/** Keşfet gönderileri (Mahallem yalnızca o mahalleye, Bölgesel yalnızca o ile görünür). */
export const postRepository = createFirestorePostRepository(firestore);
/** Keşfet profili, takip ve engelleme. */
export const socialRepository = createFirestoreSocialRepository(firestore);
/** Keşfet rozetleri listesi (oturumda bir kez okunur). */
export const badgeReader = createBadgeReader(firestore);
/** Birebir mesajlar (yalnızca iki taraf okur). */
export const messageRepository = createFirestoreMessageRepository(firestore);
/** Çarşı ilanları (ikinci el eşya). */
export const listingRepository = createFirestoreListingRepository(firestore);
/** İşletme doğrulama isteği: önce il yöneticisi, sonra admin onaylar (PROJE.md 6.5). */
export const verificationRequests = createVerificationRequests(firestore);
export const familyRepository = createFirestoreFamilyRepository(firestore);
export const sosRepository = createFirestoreSosRepository(firestore);
export const travelRepository = createFirestoreTravelRepository(firestore);
export const showcaseRepository = createFirestoreShowcaseRepository(firestore);
/** Fırsatlar (Sosyal Harmoni > Fırsatlar, işletme sayfası, Fırsatlarım). */
export const dealRepository = createFirestoreDealRepository(firestore);
export const needsConfig = createNeedsConfig(firestore);
/** Sosyal Harmoni: anketler, yarışmalar, şehir kulüpleri. */
export const communityRepository = createFirestoreCommunityRepository(firestore);
/** Seyahat > Planla: tatil fikirlerinin konaklama tesisleri ve ekip düzenlemesi. */
export const holidayRepository = createHolidayRepository(firestore);
export const sponsorRepository = createSponsorRepository(firestore);
export const ownerPayments = createOwnerPayments(firestore);
export const postVisibility = createPostVisibility(functions);
export const pushTokenRepository = createFirestorePushTokenRepository(firestore);
/** Benim Şehrim sabit bilgileri: il başına özet tek okuma, bölüm yalnızca değişince indirilir. */
export const cityGuide = createCityGuideStore(createFirestoreCityGuideRepository(firestore), deviceStorage);
export const serviceCategories = createServiceCategoryStore(createFirestoreServiceCategoryRepository(firestore), deviceStorage);
export const sendServiceSuggestion = (uid: string, text: string, provinceCode?: string) => submitServiceSuggestion(firestore, uid, text, provinceCode);

/** Google girişi şimdilik yalnızca web'de; telefonda yerel giriş geliştirme derlemesiyle gelecek. */
export const supportsGoogleSignIn = Platform.OS === 'web';
