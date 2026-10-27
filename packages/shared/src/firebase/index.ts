// Firebase uygulaması. Ekranlar bu dosyayı değil, services/types arayüzlerini kullanır.
export { createFirebaseAuthService } from './auth';
export { createFirestoreOccupationRepository, createFirestoreProfileRepository } from './profiles';

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}
export { createOccupationAdmin, isAdminAccount, occupationIdFromName } from './admin';
export { createEmergencyNumberAdmin, createFirestoreEmergencyNumberRepository } from './emergency';
export {
  createFirestoreServiceCategoryRepository,
  createServiceCategoryAdmin,
  submitServiceSuggestion,
} from './service-categories';
export { createBusinessAdmin, createFirestoreBusinessRepository, DuplicateBusinessError } from './businesses';
export { createFirestoreReviewRepository, createReviewModeration, type ReviewReport } from './reviews';
export {
  createFirestoreFamilyRepository,
  createFirestoreSosRepository,
  createSosSettingsAdmin,
  SosSendTimeoutError,
} from './sos';
