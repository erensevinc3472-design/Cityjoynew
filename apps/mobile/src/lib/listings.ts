import { useEffect, useState } from 'react';
import type { TFunction } from 'i18next';
import { pointInProvince, type Listing } from '@cityjoy/shared';

import { currentLocation } from './location';
import { listingRepository } from './services';

/** "1.250 TL", kiralıkta "1.250 TL / ay"; ücretsiz ve takasta türün adı. */
export function priceText(l: Pick<Listing, 'kind' | 'price' | 'rentUnit'>, t: TFunction, language: string): string {
  if (l.price == null) return t(`carsi.kinds.${l.kind}`);
  const amount = t('carsi.price', { amount: l.price.toLocaleString(language) });
  return l.kind === 'kiralik' && l.rentUnit ? `${amount} / ${t(`carsi.rentUnits.${l.rentUnit}`)}` : amount;
}

// Favoriler oturumda bir kez okunur; kalpler bu kümeye göre dolar.
let favorites: { uid: string; ids: Set<string> } | null = null;
const listeners = new Set<() => void>();

export function useFavorites(uid: string | undefined) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const tick = () => setTick((x) => x + 1);
    listeners.add(tick);
    if (uid && favorites?.uid !== uid) {
      listingRepository.favoriteIds(uid).then(
        (ids) => {
          favorites = { uid, ids };
          listeners.forEach((l) => l());
        },
        () => {},
      );
    }
    return () => {
      listeners.delete(tick);
    };
  }, [uid]);
  const ids = favorites && favorites.uid === uid ? favorites.ids : new Set<string>();
  return {
    isFavorite: (id: string) => ids.has(id),
    async toggle(id: string) {
      if (!uid) return;
      const on = !ids.has(id);
      await listingRepository.setFavorite(uid, id, on);
      const next = new Set(ids);
      if (on) next.add(id);
      else next.delete(id);
      favorites = { uid, ids: next };
      listeners.forEach((l) => l());
    },
  };
}

export type PlaceCheck = 'ok' | 'elsewhere' | 'denied' | 'unavailable';

/**
 * İlan verirken telefonun konumu kayıtlı ilde mi (bir kez, yaklaşık). Emülatörle denerken atlanır. Sahte konumla
 * aşılabilir; kayıtlı mahalle kuralı ve şikâyetle birlikte bir önlemdir.
 */
export async function checkListingPlace(provinceCode: string): Promise<PlaceCheck> {
  if (process.env.EXPO_PUBLIC_FIREBASE_EMULATOR === '1') return 'ok';
  const here = await currentLocation();
  if (here.status !== 'ready') return here.status === 'denied' ? 'denied' : 'unavailable';
  return pointInProvince(here.location, provinceCode) ? 'ok' : 'elsewhere';
}
