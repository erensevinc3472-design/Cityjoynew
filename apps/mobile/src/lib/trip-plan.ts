import { useCallback, useEffect, useState } from 'react';
import {
  mergePlaces,
  placeOfBusiness,
  pointsAlongRoute,
  PROVINCE_CENTERS,
  roadsidePackCells,
  stopsAlongRoute,
  type RouteStop,
  type RoadsidePlace,
  type TravelPrices,
  type TripPlan,
} from '@cityjoy/shared';
import { createTravelPrices } from '@cityjoy/shared/firebase';

import { firestore } from './firebase';
import { businessRepository } from './services';
import { deviceStorage } from './storage';
import { osmPlacesInCells } from './trip';

const PLANS_KEY = 'tripPlans:v1';
/** Telefonda en çok bu kadar plan saklanır (en yenisi önde). */
const MAX_PLANS = 5;

let plansCache: TripPlan[] | null = null;
const listeners = new Set<(p: TripPlan[]) => void>();

async function readPlans(): Promise<TripPlan[]> {
  if (plansCache) return plansCache;
  try {
    const raw = await deviceStorage.get(PLANS_KEY);
    plansCache = raw ? (JSON.parse(raw) as TripPlan[]) : [];
  } catch {
    plansCache = [];
  }
  return plansCache;
}

async function writePlans(list: TripPlan[]) {
  plansCache = list.slice(0, MAX_PLANS);
  listeners.forEach((l) => l(plansCache!));
  await deviceStorage.set(PLANS_KEY, JSON.stringify(plansCache));
}

/** Yolculuk planları yalnızca bu telefonda saklanır (hesaba yazılmaz, maliyet yok). */
export function useTripPlans() {
  const [plans, setPlans] = useState<TripPlan[] | null>(plansCache);
  useEffect(() => {
    readPlans().then(setPlans);
    listeners.add(setPlans);
    return () => {
      listeners.delete(setPlans);
    };
  }, []);
  const save = useCallback(async (p: TripPlan) => writePlans([p, ...(await readPlans()).filter((x) => x.id !== p.id)]), []);
  const remove = useCallback(async (id: string) => writePlans((await readPlans()).filter((x) => x.id !== id)), []);
  return { plans, save, remove };
}

const pricesService = createTravelPrices(firestore);
let pricesCache: { at: number; value: TravelPrices | null } | null = null;

/** Panelden girilen tahmini ücretler; saatte bir tazelenir. Okunamazsa ücret gösterilmez. */
export function useTravelPrices() {
  const [prices, setPrices] = useState<TravelPrices | null | undefined>(pricesCache?.value);
  useEffect(() => {
    if (pricesCache && Date.now() - pricesCache.at < 60 * 60 * 1000) return setPrices(pricesCache.value);
    pricesService
      .get()
      .then((value) => {
        pricesCache = { at: Date.now(), value };
        setPrices(value);
      })
      .catch(() => setPrices(null));
  }, []);
  return prices;
}

/**
 * Güzergâh çevresindeki mola yerleri: düz çizgi boyunca her 60 km'de bir noktanın 15 km çevresindeki yol üstü
 * paketleri ve yol üstü işletmeler okunur (paketler bir gün saklanır).
 */
export function useRouteStops(from?: string, to?: string) {
  const [stops, setStops] = useState<RouteStop[] | null>(null);
  useEffect(() => {
    const a = from ? PROVINCE_CENTERS[from] : undefined;
    const b = to ? PROVINCE_CENTERS[to] : undefined;
    if (!a || !b || from === to) return setStops([]);
    let alive = true;
    setStops(null);
    const cells = [...new Set(pointsAlongRoute(a, b).flatMap((p) => roadsidePackCells(p.lat, p.lng, 15)))];
    Promise.allSettled([osmPlacesInCells(cells), businessRepository.listInCells(cells)]).then(([osm, shops]) => {
      if (!alive) return;
      const own = shops.status === 'fulfilled' ? shops.value.map(placeOfBusiness).filter((x): x is RoadsidePlace => !!x) : [];
      setStops(stopsAlongRoute(mergePlaces(own, osm.status === 'fulfilled' ? osm.value : []), a, b));
    });
    return () => {
      alive = false;
    };
  }, [from, to]);
  return stops;
}
