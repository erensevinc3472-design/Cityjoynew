import { createEmergencyNumberStore } from '@cityjoy/shared';
import {
  createFirebaseAuthService,
  createFirestoreEmergencyNumberRepository,
  createFirestoreOccupationRepository,
  createFirestoreProfileRepository,
} from '@cityjoy/shared/firebase';
import { Platform } from 'react-native';

import { firebaseAuth, firestore } from './firebase';
import i18n from './i18n';
import { deviceStorage } from './storage';

export const authService = createFirebaseAuthService(firebaseAuth, { languageCode: () => i18n.language });
export const profileRepository = createFirestoreProfileRepository(firestore);
export const occupationRepository = createFirestoreOccupationRepository(firestore);
export const emergencyNumbers = createEmergencyNumberStore(createFirestoreEmergencyNumberRepository(firestore), deviceStorage);

/** Google girişi şimdilik yalnızca web'de; telefonda yerel giriş geliştirme derlemesiyle gelecek. */
export const supportsGoogleSignIn = Platform.OS === 'web';
