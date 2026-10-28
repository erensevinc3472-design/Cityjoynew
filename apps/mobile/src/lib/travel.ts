import { useCallback, useEffect, useState } from 'react';
import type { TravelCategory, TravelCityContent, TravelPlace, TravelRegionContent } from '@cityjoy/shared';

import type { SceneKind } from '@/components/scene-art';

import { travelRepository } from './services';

/**
 * Seyahat içeriği oturum boyunca bellekte tutulur: sabit tanıtım bilgisidir, her ekran açılışında yeniden okunmaz
 * (maliyet ilkesi). Döner: null = yükleniyor.
 */
const cache = new Map<string, unknown>();

function useCached<T>(key: string | null, load: () => Promise<T>) {
  const [value, setValue] = useState<T | null>(() => (key && cache.has(key) ? (cache.get(key) as T) : null));
  const [failed, setFailed] = useState(false);
  const run = useCallback(() => {
    if (!key) return;
    setFailed(false);
    load().then(
      (v) => {
        cache.set(key, v);
        setValue(v);
      },
      () => setFailed(true),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (!key) return;
    if (cache.has(key)) return setValue(cache.get(key) as T);
    setValue(null);
    run();
  }, [key, run]);
  return { value, failed, retry: run };
}

export const useTravelRegions = () => useCached<TravelRegionContent[]>('regions', () => travelRepository.listRegions());
export const useTravelCities = (regionId: string | undefined) =>
  useCached<TravelCityContent[]>(regionId ? `cities:${regionId}` : null, () => travelRepository.listCities(regionId!));
export const useTravelPlaces = (cityId: string | undefined) =>
  useCached<TravelPlace[]>(cityId ? `places:${cityId}` : null, () => travelRepository.listPlaces(cityId!));

/** Şehir listesinden açılan yer önbellekten gelir; doğrudan bağlantıyla açılırsa okunur. */
export function useTravelPlace(id: string | undefined) {
  const cached = [...cache.entries()]
    .filter(([k]) => k.startsWith('places:'))
    .flatMap(([, v]) => v as TravelPlace[])
    .find((p) => p.id === id);
  const fetched = useCached<TravelPlace | null>(!cached && id ? `place:${id}` : null, () => travelRepository.getPlace(id!));
  return cached ? { value: cached, failed: false, retry: () => {} } : fetched;
}

/** Görseller panelden gelene kadar çizim: bölgeye ve yer kategorisine göre. */
export const REGION_SCENES: Record<string, SceneKind> = {
  marmara: 'city',
  ege: 'travel',
  akdeniz: 'cover',
  'ic-anadolu': 'townhall',
  karadeniz: 'neighbourhood',
  'dogu-anadolu': 'showcase',
  guneydogu: 'market',
};
export const CATEGORY_SCENES: Record<TravelCategory, SceneKind> = {
  tarih: 'townhall',
  doga: 'neighbourhood',
  deniz: 'travel',
  lezzet: 'food',
  kultur: 'showcase',
  alisveris: 'market',
};
