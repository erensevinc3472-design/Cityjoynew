import { useCallback, useEffect, useState } from 'react';
import { dealLive, type Deal } from '@cityjoy/shared';

import { dealRepository } from './services';

/** İlin açık fırsatları oturumda bir kez okunur (maliyet ilkesi); süresi dolanlar telefonda düşer. */
const cache = new Map<string, Deal[]>();

export function useProvinceDeals(provinceCode: string | undefined) {
  const [list, setList] = useState<Deal[] | null>(() => (provinceCode ? cache.get(provinceCode) ?? null : null));
  const [error, setError] = useState(false);
  const load = useCallback(
    (force = false) => {
      if (!provinceCode) return;
      if (!force && cache.has(provinceCode)) return setList(cache.get(provinceCode)!);
      setError(false);
      dealRepository.listActive(provinceCode).then(
        (l) => {
          cache.set(provinceCode, l);
          setList(l);
        },
        () => setError(true),
      );
    },
    [provinceCode],
  );
  useEffect(() => load(), [load]);
  return { deals: list?.filter((d) => dealLive(d)) ?? null, error, retry: () => load(true) };
}

/** İşletme sahibi fırsat açınca / değiştirince il listesi yeniden okunur. */
export const forgetProvinceDeals = (provinceCode: string) => cache.delete(provinceCode);

/** Görüntülenme / kod / arama sayacı: aynı fırsat için oturumda bir kez. */
const counted = new Set<string>();
export function countDeal(id: string, field: 'views' | 'codeViews' | 'calls') {
  const key = `${id}:${field}`;
  if (counted.has(key)) return;
  counted.add(key);
  dealRepository.count(id, field);
}
