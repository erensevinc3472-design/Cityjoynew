import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { locationBadgeFor, type LocationBadge, type UserLocation } from '@cityjoy/shared';

import { currentLocation } from './location';
import { locationRepository as repo } from './locations';

export type BadgeCheck = LocationBadge | 'elsewhere' | 'denied' | 'unavailable' | 'web';

/**
 * Konum rozeti için telefonun konumu bir kez alınır ve adresi telefonun içinde (ücretsiz) çözülür; koordinat hiçbir yere
 * gönderilmez. Kayıtlı il ve ilçe tutarsa "ilçe", mahalle adı da tutarsa "mahalle" döner. Web'de adres çözümlemesi
 * olmadığı için yapılamaz. Emülatörle denerken konum alınmaz.
 */
export async function checkMyLocation(loc: UserLocation): Promise<BadgeCheck> {
  if (process.env.EXPO_PUBLIC_FIREBASE_EMULATOR === '1') return 'mahalle';
  if (Platform.OS === 'web') return 'web';
  if (!loc.districtId) return 'elsewhere';
  const here = await currentLocation();
  if (here.status !== 'ready') return here.status === 'denied' ? 'denied' : 'unavailable';
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: here.location.lat, longitude: here.location.lng });
    if (!place) return 'unavailable';
    const hoods = loc.neighbourhoodId ? await repo.getNeighbourhoods(loc.districtId).catch(() => []) : [];
    const badge = locationBadgeFor(
      place,
      {
        provinceCode: loc.provinceCode,
        districtName: repo.getDistrict(loc.districtId)?.name ?? '',
        neighbourhoodName: hoods.find((n) => n.id === loc.neighbourhoodId)?.name,
      },
      repo.getProvinces(),
    );
    return badge ?? 'elsewhere';
  } catch {
    return 'unavailable';
  }
}
