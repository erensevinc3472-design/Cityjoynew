import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import {
  listMunicipalities,
  routeHours,
  type LocalKind,
  type NearbyKind,
  type RouteTheme,
  type TravelCategory,
  type TravelCityContent,
  type TravelLocalItem,
  type TravelMunicipal,
  type TravelPlace,
  type TravelRegionContent,
  type TravelMode,
  type TravelRoute,
} from '@cityjoy/shared';

import type { SceneKind } from '@/components/scene-art';

import { locationRepository } from './locations';
import { travelRepository } from './services';

/**
 * Seyahat içeriği oturum boyunca bellekte tutulur: sabit tanıtım bilgisidir, her ekran açılışında yeniden okunmaz
 * (maliyet ilkesi). Boş sonuç saklanmaz (içerik yeni yayına alınmış olabilir), dolu sonuç 30 dakika sonra yenilenir.
 * Döner: null = yükleniyor.
 */
const TTL = 30 * 60 * 1000;
const store = new Map<string, { v: unknown; at: number }>();
const cache = {
  has: (k: string) => {
    const e = store.get(k);
    return !!e && Date.now() - e.at < TTL;
  },
  get: (k: string) => store.get(k)?.v,
  set: (k: string, v: unknown) => {
    if (v == null || (Array.isArray(v) && v.length === 0)) store.delete(k);
    else store.set(k, { v, at: Date.now() });
  },
  entries: () => [...store.entries()].map(([k, e]) => [k, e.v] as const),
};

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
  const cached = cache
    .entries()
    .filter(([k]) => k.startsWith('places:'))
    .flatMap(([, v]) => v as TravelPlace[])
    .find((p) => p.id === id);
  const fetched = useCached<TravelPlace | null>(!cached && id ? `place:${id}` : null, () => travelRepository.getPlace(id!));
  return cached ? { value: cached, failed: false, retry: () => {} } : fetched;
}

export const useTravelRoutes = (cityId: string | undefined) =>
  useCached<TravelRoute[]>(cityId ? `routes:${cityId}` : null, () => travelRepository.listRoutes(cityId!));
export const useTravelLocal = (cityId: string | undefined) =>
  useCached<TravelLocalItem[]>(cityId ? `local:${cityId}` : null, () => travelRepository.listLocal(cityId!));
export const useTravelMunicipal = (cityId: string | undefined) =>
  useCached<TravelMunicipal[]>(cityId ? `municipal:${cityId}` : null, () => travelRepository.listMunicipal(cityId!));

/** Rota listeden açıldıysa önbellekten gelir; doğrudan bağlantıyla açılırsa okunur. */
export function useTravelRoute(id: string | undefined) {
  const cached = cache
    .entries()
    .filter(([k]) => k.startsWith('routes:'))
    .flatMap(([, v]) => v as TravelRoute[])
    .find((r) => r.id === id);
  const fetched = useCached<TravelRoute | null>(!cached && id ? `route:${id}` : null, () => travelRepository.getRoute(id!));
  return cached ? { value: cached, failed: false, retry: () => {} } : fetched;
}

export const ROUTE_THEME_ICONS: Record<RouteTheme, ComponentProps<typeof MaterialIcons>['name']> = {
  tarih: 'castle',
  manevi: 'mosque',
  lezzet: 'restaurant',
  doga: 'forest',
  alisveris: 'storefront',
  kultur: 'theater-comedy',
  aile: 'family-restroom',
  aksam: 'nightlight',
};
export const ROUTE_THEME_SCENES: Record<RouteTheme, SceneKind> = {
  tarih: 'townhall',
  manevi: 'townhall',
  lezzet: 'food',
  doga: 'neighbourhood',
  alisveris: 'market',
  kultur: 'showcase',
  aile: 'travel',
  aksam: 'city',
};
export const LOCAL_KIND_ICONS: Record<LocalKind, ComponentProps<typeof MaterialIcons>['name']> = {
  miras: 'account-balance',
  'el-sanati': 'content-cut',
  lezzet: 'restaurant',
  gelenek: 'sports-martial-arts',
};

type IconName = ComponentProps<typeof MaterialIcons>['name'];
export const MODE_ICONS: Record<TravelMode, IconName> = {
  metro: 'subway',
  otobus: 'directions-bus',
  tramvay: 'tram',
  teleferik: 'airline-seat-recline-normal',
  vapur: 'directions-boat',
  taksi: 'local-taxi',
  araba: 'directions-car',
  yuruyus: 'directions-walk',
};
export const NEARBY_ICONS: Record<NearbyKind, IconName> = { otopark: 'local-parking', yemek: 'restaurant', wc: 'wc', atm: 'local-atm', saglik: 'local-hospital' };

/** "4,5 saat" / "45 dk" (dile göre ondalık). */
export function useDurationText() {
  const { t, i18n } = useTranslation();
  return (minutes: number) => {
    const d = routeHours(minutes);
    return d.hours != null ? t('travel.hoursText', { value: d.hours.toLocaleString(i18n.language) }) : t('travel.minutesText', { value: d.minutes });
  };
}

/** İlin belediyeleri: büyükşehir / il belediyesi önce, sonra ilçeler (kimlik: kurum kimliği). */
export function cityMunicipalities(code: string) {
  const p = locationRepository.getProvince(code);
  return p ? listMunicipalities([p], locationRepository.getDistricts(code)) : [];
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
