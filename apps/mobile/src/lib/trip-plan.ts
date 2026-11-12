import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { distanceKm, PROVINCE_CENTERS, type Itinerary, type LatLng, type PlanMove } from '@cityjoy/shared';

import { currentLocation } from './location';

/**
 * Yakınımda ve Gezimi planla için ortak yardımcılar (Karar, Eren, 12 Kasım 2026). Konum yalnızca sayfa açılınca bir kez
 * alınır, hiçbir yere gönderilmez. İzin yoksa ya da kişi o ilde değilse ilin merkezine göre hesaplanır.
 */

/** Kişi il merkezine bu kadar uzaksa "şehirde değil" sayılır. */
const FAR_KM = 60;

export type OriginSource = 'gps' | 'center' | 'far';

export function useTripOrigin(code: string | undefined, ask = true) {
  const center = code ? PROVINCE_CENTERS[code] : undefined;
  const [state, setState] = useState<{ origin?: LatLng; source: OriginSource; loading: boolean }>({ origin: center, source: 'center', loading: ask });
  const locate = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const r = await currentLocation();
    if (r.status === 'ready') {
      const here = { lat: r.location.lat, lng: r.location.lng };
      if (center && distanceKm(here, center) > FAR_KM) setState({ origin: center, source: 'far', loading: false });
      else setState({ origin: here, source: 'gps', loading: false });
    } else setState({ origin: center, source: 'center', loading: false });
  }, [center]);
  useEffect(() => {
    if (ask) locate();
  }, [ask, locate]);
  return { ...state, locate };
}

/** Bugünün tarihi ("2026-11-13") ve gün içindeki dakika (cihaz saatine göre). */
export function nowLocal(d = new Date()) {
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { date, minutes: d.getHours() * 60 + d.getMinutes() };
}

/** "8 dk yürüme" / "12 km · arabayla 25 dk". */
export function useMoveText() {
  const { t, i18n } = useTranslation();
  return (m: PlanMove) =>
    m.mode === 'yuruyus' ? t('travel.walkMin', { min: m.minutes }) : t('travel.driveMin', { min: m.minutes, km: m.km.toLocaleString(i18n.language, { maximumFractionDigits: 1 }) });
}

// Kaydedilen program yalnızca bu cihazda durur (yer kimlikleri ve saatler; kişisel bilgi yok).
const key = (code: string) => `cityjoy.trip.${code}`;

export async function loadTrip(code: string): Promise<Itinerary | null> {
  try {
    const raw = await AsyncStorage.getItem(key(code));
    return raw ? (JSON.parse(raw) as Itinerary) : null;
  } catch {
    return null;
  }
}

export async function saveTrip(plan: Itinerary) {
  try {
    await AsyncStorage.setItem(key(plan.cityId), JSON.stringify(plan));
  } catch {
    // Kaydedilemezse program yalnızca bu oturumda kalır.
  }
}

export async function clearTrip(code: string) {
  try {
    await AsyncStorage.removeItem(key(code));
  } catch {
    // yok say
  }
}
