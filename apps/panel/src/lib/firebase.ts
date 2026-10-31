import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import type { FirebaseWebConfig } from '@cityjoy/shared/firebase';

// Değerler .env.local dosyasından gelir (GitHub'a gönderilmez).
const env = import.meta.env;
const config: FirebaseWebConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: env.VITE_FIREBASE_APP_ID ?? '',
};

export const isFirebaseConfigured = Object.values(config).every(Boolean);

const app = getApps().length ? getApp() : initializeApp(config);
export const firebaseAuth = getAuth(app);
export const firestore = getFirestore(app);
export const storage = getStorage(app);

// Kurum hesabı açmak için ayrı uygulama örneği: yeni hesap oluşturulunca admin'in kendi oturumu bozulmaz.
const accountApp = getApps().find((a) => a.name === 'hesap-acma') ?? initializeApp(config, 'hesap-acma');
export const accountAuth = getAuth(accountApp);
// Firebase'in hazır e-posta şablonları Türkçe gitsin (şablonlar konsoldan değiştirilemiyor).
firebaseAuth.languageCode = 'tr';
accountAuth.languageCode = 'tr';

// Yerel deneme: VITE_FIREBASE_EMULATOR=1 ile gerçek proje yerine emülatöre bağlanır.
if (env.VITE_FIREBASE_EMULATOR === '1') {
  connectAuthEmulator(firebaseAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectAuthEmulator(accountAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
}
