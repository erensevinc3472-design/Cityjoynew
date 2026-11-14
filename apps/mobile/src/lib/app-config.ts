import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { DEFAULT_APP_CONFIG, normalizeAppConfig, type AppConfig, type AppImage } from '@cityjoy/shared';
import { getAppConfig } from '@cityjoy/shared/firebase';

import { isFirebaseConfigured } from './firebase-config';
import { firestore } from './firebase';
import { deviceStorage } from './storage';

const KEY = 'cj.appConfig';

/**
 * Uygulama ayarları (Panel > Uygulama ayarları): açılışta bir kez okunur (oturum başına tek okuma, maliyet ilkesi),
 * telefonda saklanır. Bağlantı yoksa ya da okunamazsa son bilinen hâl, o da yoksa varsayılanlar kullanılır.
 */
let current: AppConfig = DEFAULT_APP_CONFIG;
let started = false;
const listeners = new Set<(c: AppConfig) => void>();

function publish(c: AppConfig) {
  current = c;
  listeners.forEach((l) => l(c));
}

function start() {
  if (started) return;
  started = true;
  deviceStorage.get(KEY).then((raw) => {
    if (!raw || current !== DEFAULT_APP_CONFIG) return;
    try {
      publish(normalizeAppConfig(JSON.parse(raw)));
    } catch {}
  });
  if (!isFirebaseConfigured) return;
  getAppConfig(firestore)
    .then((c) => {
      publish(c);
      deviceStorage.set(KEY, JSON.stringify(c));
    })
    .catch(() => {});
}

export function useAppConfig(): AppConfig {
  const [cfg, setCfg] = useState(current);
  useEffect(() => {
    start();
    listeners.add(setCfg);
    setCfg(current);
    return () => {
      listeners.delete(setCfg);
    };
  }, []);
  return cfg;
}

/** Bu telefonun platformu (web'de sürüm denetimi yapılmaz). */
export const appPlatform: 'ios' | 'android' | null = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null;
export const appVersion: string = Constants.expoConfig?.version ?? '0.0.0';

/** Panelden yüklenen giriş resmi; yoksa uygulamadaki hazır resim. */
export function useAppImage(key: AppImage): string {
  return useAppConfig().images[key];
}
