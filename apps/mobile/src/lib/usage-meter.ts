import AsyncStorage from '@react-native-async-storage/async-storage';
import { httpsCallable } from 'firebase/functions';
import { AppState } from 'react-native';
import { isCostSampled } from '@cityjoy/shared';
import { takeFirestoreUsage } from '@cityjoy/shared/firebase';

import { firebaseAuth, functions } from '@/lib/firebase';

/**
 * Özelliklere göre harcama ölçümü (Panel > Harcama; packages/shared/src/billing/cost.ts). Veritabanı işlemleri bellekte
 * koleksiyona göre sayılır; yalnızca örneklemdeki kullanıcılar (yüzde 5) uygulama arka plana geçince, son gönderimden
 * en az 4 saat geçtiyse tek çağrıyla gönderir. Örneklem dışındakilerde sayım gönderilmeden atılır.
 */
const KEY = 'cityjoy.usageMeter.lastSent';
const EVERY_MS = 4 * 3600_000;
let sending = false;

async function maybeSend() {
  const uid = firebaseAuth.currentUser?.uid;
  if (sending || !uid || !isCostSampled(uid)) {
    takeFirestoreUsage();
    return;
  }
  sending = true;
  try {
    const last = Number((await AsyncStorage.getItem(KEY).catch(() => null)) ?? 0);
    if (Date.now() - last < EVERY_MS) return;
    const usage = takeFirestoreUsage();
    if (!Object.keys(usage.reads).length && !Object.keys(usage.writes).length) return;
    await AsyncStorage.setItem(KEY, String(Date.now())).catch(() => {});
    await httpsCallable(functions, 'reportUsage')(usage);
  } catch {
    // Ağ yoksa bu dilim kaybolur (yalnızca tahmin etkilenir).
  } finally {
    sending = false;
  }
}

AppState.addEventListener('change', (s) => {
  if (s !== 'active') maybeSend();
});
