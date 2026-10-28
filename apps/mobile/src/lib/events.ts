import { useCallback, useEffect, useState } from 'react';
import { isEventVisible, sortEvents, type CityEvent } from '@cityjoy/shared';

import { eventRepository } from './services';

/** İl başına son okuma; liste ve ayrıntı aynı sonucu paylaşır, 5 dakikada bir tazelenir (maliyet ilkesi). */
const cache = new Map<string, { at: number; list: CityEvent[] }>();
const TTL = 5 * 60 * 1000;

/** İldeki yaklaşan etkinlikler (yayında ya da iptal edilmiş, bitmemiş), başlama sırasıyla. */
export function useEvents(provinceCode: string | undefined) {
  const [list, setList] = useState<CityEvent[] | null>(() => (provinceCode ? (cache.get(provinceCode)?.list ?? null) : []));
  const [failed, setFailed] = useState(false);

  const load = useCallback(
    async (force = false) => {
      if (!provinceCode) return setList([]);
      const hit = cache.get(provinceCode);
      if (hit && !force && Date.now() - hit.at < TTL) return setList(hit.list);
      setFailed(false);
      try {
        const fresh = await eventRepository.listUpcoming(provinceCode);
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

  const now = new Date();
  return { list: list ? sortEvents(list.filter((e) => isEventVisible(e, now))) : null, failed, reload: () => load(true) };
}

export function cachedEvent(id: string): CityEvent | undefined {
  for (const { list } of cache.values()) {
    const e = list.find((x) => x.id === id);
    if (e) return e;
  }
  return undefined;
}

/** Katılım sayısı değişince önbellekteki kaydı da günceller (liste yeniden okunmadan doğru görünsün). */
export function patchCachedEvent(id: string, patch: Partial<CityEvent>) {
  for (const entry of cache.values()) entry.list = entry.list.map((e) => (e.id === id ? { ...e, ...patch } : e));
}
