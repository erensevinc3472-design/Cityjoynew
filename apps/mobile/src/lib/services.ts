import {
  createFirebaseAuthService,
  createFirestoreOccupationRepository,
  createFirestoreProfileRepository,
} from '@cityjoy/shared/firebase';
import { Platform } from 'react-native';

import { firebaseAuth, firestore } from './firebase';
import i18n from './i18n';

export const authService = createFirebaseAuthService(firebaseAuth, { languageCode: () => i18n.language });
export const profileRepository = createFirestoreProfileRepository(firestore);
export const occupationRepository = createFirestoreOccupationRepository(firestore);

/** Google girişi şimdilik yalnızca web'de; telefonda yerel giriş geliştirme derlemesiyle gelecek. */
export const supportsGoogleSignIn = Platform.OS === 'web';
