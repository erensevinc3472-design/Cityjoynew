import { createFirebaseAuthService } from '@cityjoy/shared/firebase';

import { firebaseAuth } from './firebase';

export const authService = createFirebaseAuthService(firebaseAuth, { languageCode: () => 'tr' });
