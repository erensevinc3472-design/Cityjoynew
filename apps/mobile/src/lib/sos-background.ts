import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { SOS_BACKGROUND_TASK, shouldSendLocation, type SosLocation } from '@cityjoy/shared';

import { firebaseAuth } from './firebase';
import { sosRepository } from './services';

/**
 * SOS sürerken arka planda konum (Eren: ekran kilitlense ya da uygulama kapansa da konum gitmeli).
 * Yalnızca SOS süresince çalışır ve süre dolunca, "Güvendeyim" ya da "Durdur" denince kendini kapatır.
 * Android'de bu sırada "SOS: konumunuz paylaşılıyor" bildirimi görünür (işletim sistemi kuralı).
 */
const KEY = 'sos:background:v1';
type Active = { id: string; liveUntil: string; last?: SosLocation };

export const backgroundSupported = Platform.OS !== 'web';

const read = async (): Promise<Active | null> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Active) : null;
  } catch {
    return null;
  }
};

async function stopTask() {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(SOS_BACKGROUND_TASK)) await Location.stopLocationUpdatesAsync(SOS_BACKGROUND_TASK);
  } catch {}
}

// Görev, uygulama kapalıyken de çalışabilmesi için modül yüklenirken tanımlanır (_layout içe aktarır).
if (backgroundSupported) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(SOS_BACKGROUND_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    const active = await read();
    if (!active || new Date(active.liveUntil) < new Date()) {
      await AsyncStorage.removeItem(KEY).catch(() => {});
      await stopTask();
      return;
    }
    const p = data.locations[data.locations.length - 1];
    const loc = { lat: p.coords.latitude, lng: p.coords.longitude, ...(p.coords.accuracy != null ? { accuracy: Math.round(p.coords.accuracy) } : {}) };
    if (!shouldSendLocation(active.last, loc)) return;
    try {
      // Uygulama arka planda yeni açıldıysa oturumun yüklenmesi beklenir.
      await firebaseAuth.authStateReady();
      await sosRepository.updateLocation(active.id, loc);
      await AsyncStorage.setItem(KEY, JSON.stringify({ ...active, last: { ...loc, at: new Date().toISOString() } }));
    } catch {
      // İnternet yoksa bir sonraki konumda yeniden denenir.
    }
  });
}

export async function backgroundPermission(): Promise<'granted' | 'denied' | 'undetermined' | 'unsupported'> {
  if (!backgroundSupported) return 'unsupported';
  try {
    return (await Location.getBackgroundPermissionsAsync()).status;
  } catch {
    return 'unsupported';
  }
}

/** "Her zaman" konum iznini ister (önce "uygulama açıkken" izni gerekir). */
export async function requestBackgroundPermission(): Promise<'granted' | 'denied' | 'undetermined' | 'unsupported'> {
  if (!backgroundSupported) return 'unsupported';
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return fg.status;
    return (await Location.requestBackgroundPermissionsAsync()).status;
  } catch {
    return 'unsupported';
  }
}

/** SOS gönderilince başlatılır. İzin yoksa false döner; ekran o zaman yalnızca açıkken günceller. */
export async function startBackgroundSharing(id: string, liveUntil: string, texts: { title: string; body: string }): Promise<boolean> {
  if (!backgroundSupported) return false;
  try {
    if ((await Location.getBackgroundPermissionsAsync()).status !== 'granted') {
      if ((await requestBackgroundPermission()) !== 'granted') return false;
    }
    await AsyncStorage.setItem(KEY, JSON.stringify({ id, liveUntil } satisfies Active));
    await Location.startLocationUpdatesAsync(SOS_BACKGROUND_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 15_000,
      distanceInterval: 20,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      activityType: Location.ActivityType.Other,
      foregroundService: { notificationTitle: texts.title, notificationBody: texts.body, notificationColor: '#C0392B', killServiceOnDestroy: false },
    });
    return true;
  } catch {
    return false;
  }
}

export async function stopBackgroundSharing() {
  if (!backgroundSupported) return;
  await AsyncStorage.removeItem(KEY).catch(() => {});
  await stopTask();
}

/** Bu SOS için arka plan paylaşımı sürüyor mu? */
export async function isBackgroundSharing(id: string): Promise<boolean> {
  if (!backgroundSupported) return false;
  const active = await read();
  return active?.id === id && (await Location.hasStartedLocationUpdatesAsync(SOS_BACKGROUND_TASK).catch(() => false));
}
