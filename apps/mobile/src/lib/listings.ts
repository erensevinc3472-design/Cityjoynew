import { useEffect, useSyncExternalStore } from 'react';
import type { TFunction } from 'i18next';
import * as Location from 'expo-location';
import { pointInProvince, provinceCodeFromPlaceName, type Listing } from '@cityjoy/shared';

import { currentLocation } from './location';
import { locationRepository } from './locations';
import { listingRepository } from './services';

/** "1.250 TL", kiralıkta "1.250 TL / ay"; ücretsiz ve takasta türün adı. */
export function priceText(l: Pick<Listing, 'kind' | 'price' | 'rentUnit'>, t: TFunction, language: string): string {
  if (l.price == null) return t(`carsi.kinds.${l.kind}`);
  const amount = t('carsi.price', { amount: l.price.toLocaleString(language) });
  return l.kind === 'kiralik' && l.rentUnit ? `${amount} / ${t(`carsi.rentUnits.${l.rentUnit}`)}` : amount;
}

// Favoriler oturumda bir kez okunur; kalpler bu kümeye göre dolar. Her değişiklikte yeni nesne yazılır ve ekranlar
// useSyncExternalStore ile haber alır (React Compiler modül değişkenindeki değişikliği kendiliğinden görmez).
let favorites: { uid: string; ids: Set<string> } | null = null;
const listeners = new Set<() => void>();
const EMPTY = new Set<string>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const snapshot = () => favorites;
const publish = (next: { uid: string; ids: Set<string> }) => {
  favorites = next;
  listeners.forEach((l) => l());
};

export function useFavorites(uid: string | undefined) {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    let retry: ReturnType<typeof setTimeout> | undefined;
    // Açılışta oturum anahtarı henüz hazır değilse okuma reddedilebilir: kısa süre sonra bir kez daha denenir.
    const load = (again: boolean) => {
      if (!uid || favorites?.uid === uid) return;
      listingRepository.favoriteIds(uid).then(
        (ids) => publish({ uid, ids }),
        () => {
          if (again) retry = setTimeout(() => load(false), 2000);
        },
      );
    };
    load(true);
    return () => {
      if (retry) clearTimeout(retry);
    };
  }, [uid]);
  const ids = current && current.uid === uid ? current.ids : EMPTY;
  return {
    isFavorite: (id: string) => ids.has(id),
    async toggle(id: string) {
      if (!uid) return;
      const on = !ids.has(id);
      await listingRepository.setFavorite(uid, id, on);
      const next = new Set(favorites?.uid === uid ? favorites.ids : ids);
      if (on) next.add(id);
      else next.delete(id);
      publish({ uid, ids: next });
    },
  };
}

export type PlaceCheck = 'ok' | 'elsewhere' | 'denied' | 'unavailable';

/**
 * İlan verirken telefonun konumu kayıtlı ilde mi (her yeni ilanda). Önce telefonun kendi adres çözümlemesi (cihazda,
 * ücretsiz) hangi ilde olduğunu söyler; il adı tanınmazsa ya da çözümleme yoksa (web) il merkezlerine uzaklığa bakılır.
 * Böylece kişi başka bir ile ilan veremez. Emülatörle denerken atlanır. Sahte konumla aşılabilir; kayıtlı mahalle kuralı
 * ve şikâyetle birlikte bir önlemdir.
 */
export async function checkListingPlace(provinceCode: string): Promise<PlaceCheck> {
  if (process.env.EXPO_PUBLIC_FIREBASE_EMULATOR === '1') return 'ok';
  const here = await currentLocation();
  if (here.status !== 'ready') return here.status === 'denied' ? 'denied' : 'unavailable';
  const { lat, lng } = here.location;
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const provinces = locationRepository.getProvinces();
    const code = provinceCodeFromPlaceName(place?.region, provinces) ?? provinceCodeFromPlaceName(place?.subregion, provinces);
    if (code) return code === provinceCode ? 'ok' : 'elsewhere';
  } catch {
    // Adres çözümlemesi yoksa uzaklık denetimi.
  }
  return pointInProvince(here.location, provinceCode) ? 'ok' : 'elsewhere';
}
