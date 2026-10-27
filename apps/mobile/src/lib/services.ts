import { createEmergencyNumberStore, createServiceCategoryStore } from '@cityjoy/shared';
import {
  createFirebaseAuthService,
  createFirestoreBusinessRepository,
  createFirestoreEmergencyNumberRepository,
  createFirestoreOccupationRepository,
  createFirestoreProfileRepository,
  createFirestoreServiceCategoryRepository,
  submitServiceSuggestion,
} from '@cityjoy/shared/firebase';
import { Platform } from 'react-native';

import { firebaseAuth, firestore } from './firebase';
import i18n from './i18n';
import { deviceStorage } from './storage';

export const authService = createFirebaseAuthService(firebaseAuth, { languageCode: () => i18n.language });
export const profileRepository = createFirestoreProfileRepository(firestore);
export const occupationRepository = createFirestoreOccupationRepository(firestore);
export const emergencyNumbers = createEmergencyNumberStore(createFirestoreEmergencyNumberRepository(firestore), deviceStorage);
export const businessRepository = createFirestoreBusinessRepository(firestore);
export const serviceCategories = createServiceCategoryStore(createFirestoreServiceCategoryRepository(firestore), deviceStorage);
export const sendServiceSuggestion = (uid: string, text: string, provinceCode?: string) => submitServiceSuggestion(firestore, uid, text, provinceCode);

/** Google girişi şimdilik yalnızca web'de; telefonda yerel giriş geliştirme derlemesiyle gelecek. */
export const supportsGoogleSignIn = Platform.OS === 'web';
