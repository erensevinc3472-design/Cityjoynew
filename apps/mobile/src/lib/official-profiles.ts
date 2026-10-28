import { useCallback, useEffect, useState } from 'react';
import type { OfficialProfile } from '@cityjoy/shared';

import { officialProfileRepository } from './services';

/** Profil başına son okuma (yoksa null da saklanır); 30 dakikada bir tazelenir (maliyet ilkesi). */
const cache = new Map<string, { at: number; profile: OfficialProfile | null }>();
const TTL = 30 * 60 * 1000;

const fresh = (id: string) => {
  const hit = cache.get(id);
  return hit && Date.now() - hit.at < TTL ? hit : undefined;
};

/**
 * Resmî profiller (kurum, muhtarlık). Döner: kimlik > profil (yoksa null); okunmamışlar listede yok.
 * Okunamayanlar boş geçilir; ekran profil olmadan da çalışır.
 */
export function useOfficialProfiles(ids: string[]) {
  const key = ids.join('|');
  const [profiles, setProfiles] = useState<Record<string, OfficialProfile | null>>(() =>
    Object.fromEntries(ids.flatMap((id) => (fresh(id) ? [[id, fresh(id)!.profile]] : []))),
  );
  const [loading, setLoading] = useState(ids.some((id) => !fresh(id)));

  const load = useCallback(async () => {
    const list = key ? key.split('|') : [];
    const missing = list.filter((id) => !fresh(id));
    if (!missing.length) {
      setProfiles(Object.fromEntries(list.map((id) => [id, cache.get(id)!.profile])));
      return setLoading(false);
    }
    setLoading(true);
    const got = await Promise.all(missing.map((id) => officialProfileRepository.get(id).then((p) => [id, p] as const, () => [id, undefined] as const)));
    for (const [id, p] of got) if (p !== undefined) cache.set(id, { at: Date.now(), profile: p });
    setProfiles(Object.fromEntries(list.flatMap((id) => (cache.has(id) ? [[id, cache.get(id)!.profile]] : []))));
    setLoading(false);
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  return { profiles, loading };
}

export function useOfficialProfile(id: string | null | undefined) {
  const { profiles, loading } = useOfficialProfiles(id ? [id] : []);
  return { profile: id ? profiles[id] : null, loading, known: !!id && id in profiles };
}
