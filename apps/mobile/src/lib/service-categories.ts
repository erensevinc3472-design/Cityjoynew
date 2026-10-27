import { useEffect, useState } from 'react';
import type { ServiceCategory } from '@cityjoy/shared';

import { isFirebaseConfigured } from './firebase-config';
import { serviceCategories } from './services';

/**
 * Hizmet kategorileri: önce telefonda saklı liste (yoksa gömülü başlangıç listesi), sonra sunucuda
 * değişiklik varsa yenisi. Boş dizi "başlangıç listesi" demektir (buildCategoryTree onu kullanır).
 */
export function useServiceCategories(): { all: ServiceCategory[]; stale: boolean } {
  const [all, setAll] = useState<ServiceCategory[]>([]);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let alive = true;
    let refreshed = false;
    serviceCategories.cached().then((list) => alive && !refreshed && setAll(list));
    if (isFirebaseConfigured) {
      serviceCategories
        .refresh()
        .then((list) => {
          refreshed = true;
          if (alive) {
            setAll(list);
            setStale(false);
          }
        })
        .catch(() => alive && setStale(true));
    }
    return () => {
      alive = false;
    };
  }, []);

  return { all, stale };
}
