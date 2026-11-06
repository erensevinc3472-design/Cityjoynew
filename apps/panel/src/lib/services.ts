import { createFirebaseAuthService } from '@cityjoy/shared/firebase';

import { firebaseAuth } from './firebase';

// E-posta bağlantısından sonra "Devam" panele döner (emülatörde verilmez).
const host = firebaseAuth.app.options.projectId;
export const authService = createFirebaseAuthService(firebaseAuth, {
  languageCode: () => 'tr',
  continueUrl: () => (host && !host.startsWith('demo-') && import.meta.env.VITE_FIREBASE_EMULATOR !== '1' ? `https://${host}.web.app/` : undefined),
});
