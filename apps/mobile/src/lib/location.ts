import * as Location from 'expo-location';
import type { SosLocation } from '@cityjoy/shared';

export type LocationState =
  | { status: 'waiting' }
  | { status: 'ready'; location: Omit<SosLocation, 'at'> }
  | { status: 'denied' }
  | { status: 'unavailable' };

const toLoc = (p: Location.LocationObject): Omit<SosLocation, 'at'> => ({
  lat: p.coords.latitude,
  lng: p.coords.longitude,
  ...(p.coords.accuracy != null ? { accuracy: Math.round(p.coords.accuracy) } : {}),
});

/**
 * Yalnızca uygulama açıkken konum (arka planda izleme yok, PROJE.md 5.1 gizlilik). İzin yoksa ya da
 * konum alınamazsa SOS yine gider, yalnızca konumsuz.
 */
export async function currentLocation(): Promise<LocationState> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return { status: 'denied' };
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((r) => setTimeout(() => r(null), 15_000)),
    ]);
    return pos ? { status: 'ready', location: toLoc(pos) } : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}

/** Canlı konum (SOS sürerken, ekran açıkken). Dönen işlev izlemeyi durdurur. */
export async function watchLocation(onChange: (l: Omit<SosLocation, 'at'>) => void): Promise<() => void> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted') return () => {};
    const sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 10_000, distanceInterval: 20 }, (p) =>
      onChange(toLoc(p)),
    );
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
