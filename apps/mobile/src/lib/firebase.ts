import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

import { firebaseConfig } from './firebase-config';

// Web: oturum tarayıcıda saklanır. Telefon için firebase.native.ts kullanılır.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);
export const firestore = getFirestore(app);

// Yerel deneme: EXPO_PUBLIC_FIREBASE_EMULATOR=1 ile gerçek proje yerine emülatöre bağlanır.
if (process.env.EXPO_PUBLIC_FIREBASE_EMULATOR === '1') {
  connectAuthEmulator(firebaseAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
}
