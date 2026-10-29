import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { bearingDeg, distanceKm, geohashCellsAround, type Business } from '@cityjoy/shared';

import { businessRepository } from './services';

type Point = { lat: number; lng: number };
export type TripState = 'waiting' | 'ready' | 'denied' | 'unavailable';

/** Bu kadar yol gidince yakındaki tesisler yeniden okunur (maliyet ilkesi). */
const REFRESH_KM = 5;
/** Yön, en az bu kadar aralıklı iki konumdan hesaplanır (yerinde sayarken yön oynamasın). */
const HEADING_KM = 0.15;

/**
 * Yoldayım: yalnızca ekran açıkken konum izlenir (arka planda takip yok, PROJE.md 5.1 gizlilik). Gidilen yön, yolda
 * geçen süre ve gidilen yol tutulur. Konum telefondan çıkmaz; yalnızca yakındaki tesisler için kaba hücre (yaklaşık
 * 20-40 km) sorgulanır.
 */
export function useTrip() {
  const [state, setState] = useState<TripState>('waiting');
  const [pos, setPos] = useState<Point | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [km, setKm] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const last = useRef<Point | null>(null);
  const sub = useRef<Location.LocationSubscription | null>(null);

  const start = useCallback(async () => {
    setState('waiting');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return setState('denied');
      sub.current?.remove();
      sub.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 5_000, distanceInterval: 50 }, (p) => {
        const here = { lat: p.coords.latitude, lng: p.coords.longitude };
        setState('ready');
        setPos(here);
        const prev = last.current;
        if (!prev) {
          last.current = here;
          return;
        }
        const step = distanceKm(prev, here);
        if (step < HEADING_KM) return;
        // Telefonun verdiği yön araç giderken daha doğrudur; yoksa son iki konumdan hesaplanır.
        const h = p.coords.heading != null && p.coords.heading >= 0 && (p.coords.speed ?? 0) > 2 ? p.coords.heading : bearingDeg(prev, here);
        setHeading(h);
        // Konum sıçramalarını yol saymamak için tek adımda 5 km üstü atılır.
        if (step < 5) setKm((k) => k + step);
        last.current = here;
      });
    } catch {
      setState('unavailable');
    }
  }, []);

  useEffect(() => {
    start();
    return () => sub.current?.remove();
  }, [start]);

  return { state, pos, heading, km, startedAt, retry: start };
}

/** Yakındaki yol üstü tesisler; yolcu 5 km ilerleyince yeniden okunur. */
export function useNearbyRoadside(pos: Point | null) {
  const [list, setList] = useState<Business[] | null>(null);
  const [failed, setFailed] = useState(false);
  const at = useRef<Point | null>(null);

  const load = useCallback(async (p: Point) => {
    at.current = p;
    setFailed(false);
    try {
      setList(await businessRepository.listInCells(geohashCellsAround(p.lat, p.lng)));
    } catch {
      setFailed(true);
      setList((x) => x ?? []);
    }
  }, []);

  useEffect(() => {
    if (pos && (!at.current || distanceKm(at.current, pos) >= REFRESH_KM)) load(pos);
  }, [pos, load]);

  return { list, failed, reload: () => pos && load(pos) };
}
