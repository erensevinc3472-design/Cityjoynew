import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyValueCache } from '@cityjoy/shared';

/** Telefonda kalıcı anahtar-değer deposu. Hata olursa sessizce önbelleksiz devam eder. */
export const deviceStorage: KeyValueCache & { remove(key: string): Promise<void> } = {
  async get(key) {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key, value) {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // Depolama doluysa ya da erişilemiyorsa veri yine bellekte kullanılır.
    }
  },
  async remove(key) {
    try {
      await AsyncStorage.removeItem(key);
    } catch {}
  },
};
