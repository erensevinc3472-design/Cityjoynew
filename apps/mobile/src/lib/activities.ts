import { useCallback, useEffect, useState } from 'react';
import { isActivityListed, sortActivities, type Activity } from '@cityjoy/shared';

import { locationRepository as repo } from './locations';
import { activityRepository } from './services';

/** Listede görünen mahallelerin adları (mahalle dosyası il başına bir kez indirilir). */
export function useNeighbourhoodNames(list: Pick<Activity, 'region'>[] | null) {
  const [names, setNames] = useState<Record<string, string>>({});
  const districts = [...new Set((list ?? []).map((a) => a.region.districtId))].sort().join();
  useEffect(() => {
    if (!districts) return;
    Promise.all(districts.split(',').map((d) => repo.getNeighbourhoods(d).catch(() => []))).then((all) =>
      setNames(Object.fromEntries(all.flat().map((n) => [n.id, n.name]))),
    );
  }, [districts]);
  return names;
}

/** İl başına son okuma; liste ve ayrıntı aynı sonucu paylaşır, 5 dakikada bir tazelenir (maliyet ilkesi). */
const cache = new Map<string, { at: number; list: Activity[] }>();
const TTL = 5 * 60 * 1000;

/** İldeki yaklaşan aktiviteler (giriş gerekir); şikâyetle düşenler ve başlamış olanlar listede yok. */
export function useActivities(provinceCode: string | undefined, signedIn: boolean) {
  const key = signedIn ? provinceCode : undefined;
  const [list, setList] = useState<Activity[] | null>(() => (key ? (cache.get(key)?.list ?? null) : []));
  const [failed, setFailed] = useState(false);

  const load = useCallback(
    async (force = false) => {
      if (!key) return setList([]);
      const hit = cache.get(key);
      if (hit && !force && Date.now() - hit.at < TTL) return setList(hit.list);
      setFailed(false);
      try {
        const fresh = await activityRepository.listUpcoming(key);
        cache.set(key, { at: Date.now(), list: fresh });
        setList(fresh);
      } catch {
        setFailed(true);
        setList((x) => x ?? []);
      }
    },
    [key],
  );

  useEffect(() => {
    load();
  }, [load]);

  const now = new Date();
  return { list: list ? sortActivities(list.filter((a) => isActivityListed(a, now))) : null, failed, reload: () => load(true) };
}

export function cachedActivity(id: string): Activity | undefined {
  for (const { list } of cache.values()) {
    const a = list.find((x) => x.id === id);
    if (a) return a;
  }
  return undefined;
}

/** Katılım, iptal ya da yeni aktivite sonrası önbelleği günceller (liste yeniden okunmadan doğru görünsün). */
export function patchCachedActivity(id: string, patch: Partial<Activity>) {
  for (const entry of cache.values()) entry.list = entry.list.map((a) => (a.id === id ? { ...a, ...patch } : a));
}

/** Yeni açılan aktivite bir sonraki listede hemen görünsün. */
export function forgetActivities(provinceCode: string) {
  cache.delete(provinceCode);
}
