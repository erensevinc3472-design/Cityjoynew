import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { createLocationRepository, LOCATION_DATA_VERSION } from '@cityjoy/shared';

import { deviceStorage } from './storage';

/**
 * Mahalle dosyalarının adresi (veri havuzu). Canlıda EXPO_PUBLIC_LOCATIONS_BASE_URL ile verilir
 * (örn. Firebase Hosting); geliştirmede uygulamanın kendi public/ klasöründen okunur.
 */
function neighbourhoodsBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_LOCATIONS_BASE_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (Platform.OS === 'web') return './locations/neighbourhoods';
  const host = Constants.expoConfig?.hostUri;
  return host ? `http://${host}/locations/neighbourhoods` : '';
}

export const locationRepository = createLocationRepository({
  neighbourhoodsBaseUrl: neighbourhoodsBaseUrl(),
  dataVersion: LOCATION_DATA_VERSION,
  cache: deviceStorage,
});
