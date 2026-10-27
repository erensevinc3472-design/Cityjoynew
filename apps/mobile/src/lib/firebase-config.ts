import type { FirebaseWebConfig } from '@cityjoy/shared/firebase';

// Değerler .env.local dosyasından gelir (GitHub'a gönderilmez). Expo yalnızca doğrudan yazılan
// process.env.EXPO_PUBLIC_* ifadelerini derlemeye koyar, bu yüzden tek tek okunur.
const config: FirebaseWebConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

export const firebaseConfig = config;
export const isFirebaseConfigured = Object.values(config).every(Boolean);
