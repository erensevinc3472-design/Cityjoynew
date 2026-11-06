import { useCallback, useEffect, useState } from 'react';
import { sortAdoptions, type Adoption } from '@cityjoy/shared';

import { adoptionRepository } from './services';

/** İl başına son okuma; liste ve ayrıntı aynı sonucu paylaşır, 10 dakikada bir tazelenir (maliyet ilkesi). */
const cache = new Map<string, { at: number; list: Adoption[] }>();
const TTL = 10 * 60 * 1000;

/** İlde yuva arayan hayvanlar (belediye barınakları ve dernekler), acil olanlar önce. */
export function useAdoptions(provinceCode: string | undefined) {
  const [list, setList] = useState<Adoption[] | null>(() => (provinceCode ? (cache.get(provinceCode)?.list ?? null) : []));
  const [failed, setFailed] = useState(false);
  const load = useCallback(
    async (force = false) => {
      if (!provinceCode) return setList([]);
      const hit = cache.get(provinceCode);
      if (hit && !force && Date.now() - hit.at < TTL) return setList(hit.list);
      setFailed(false);
      try {
        const fresh = sortAdoptions(await adoptionRepository.listLive(provinceCode));
        cache.set(provinceCode, { at: Date.now(), list: fresh });
        setList(fresh);
      } catch {
        setFailed(true);
        setList((x) => x ?? []);
      }
    },
    [provinceCode],
  );
  useEffect(() => {
    load();
  }, [load]);
  return { list, failed, reload: () => load(true) };
}

export function cachedAdoption(id: string): Adoption | undefined {
  for (const { list } of cache.values()) {
    const a = list.find((x) => x.id === id);
    if (a) return a;
  }
  return undefined;
}
