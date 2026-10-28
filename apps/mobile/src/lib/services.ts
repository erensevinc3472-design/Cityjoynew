import { createCityGuideStore, createEmergencyNumberStore, createServiceCategoryStore } from '@cityjoy/shared';
import {
  createFirebaseAuthService,
  createFirestoreAnnouncementRepository,
  createFirestoreEventRepository,
  createFirestoreCityGuideRepository,
  createFirestoreBusinessRepository,
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

import { firebaseAuth, firestore } from './firebase';
import i18n from './i18n';
import { deviceStorage } from './storage';

export const authService = createFirebaseAuthService(firebaseAuth, { languageCode: () => i18n.language });
export const profileRepository = createFirestoreProfileRepository(firestore);
export const occupationRepository = createFirestoreOccupationRepository(firestore);
export const emergencyNumbers = createEmergencyNumberStore(createFirestoreEmergencyNumberRepository(firestore), deviceStorage);
export const businessRepository = createFirestoreBusinessRepository(firestore);
export const reviewRepository = createFirestoreReviewRepository(firestore);
export const announcementRepository = createFirestoreAnnouncementRepository(firestore);
export const eventRepository = createFirestoreEventRepository(firestore);
/** İşletme doğrulama isteği: önce il yöneticisi, sonra admin onaylar (PROJE.md 6.5). */
export const verificationRequests = createVerificationRequests(firestore);
export const familyRepository = createFirestoreFamilyRepository(firestore);
export const sosRepository = createFirestoreSosRepository(firestore);
export const pushTokenRepository = createFirestorePushTokenRepository(firestore);
/** Benim Şehrim sabit bilgileri: il başına özet tek okuma, bölüm yalnızca değişince indirilir. */
export const cityGuide = createCityGuideStore(createFirestoreCityGuideRepository(firestore), deviceStorage);
export const serviceCategories = createServiceCategoryStore(createFirestoreServiceCategoryRepository(firestore), deviceStorage);
export const sendServiceSuggestion = (uid: string, text: string, provinceCode?: string) => submitServiceSuggestion(firestore, uid, text, provinceCode);

/** Google girişi şimdilik yalnızca web'de; telefonda yerel giriş geliştirme derlemesiyle gelecek. */
export const supportsGoogleSignIn = Platform.OS === 'web';
