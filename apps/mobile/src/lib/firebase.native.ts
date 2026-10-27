import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import * as authModule from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

import { firebaseConfig } from './firebase-config';

// Telefonda oturum AsyncStorage'da saklanır; uygulama kapanıp açılınca giriş korunur.
// getReactNativePersistence yalnızca Firebase'in telefon derlemesinde vardır.
const { getReactNativePersistence } = authModule as unknown as {
  getReactNativePersistence(storage: typeof AsyncStorage): authModule.Persistence;
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = authModule.initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
export const firestore = getFirestore(app);
