import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_SERVICE_CATEGORIES, resolveNeedMap, type NeedMap, type ServiceCategory } from '@cityjoy/shared';

import { isFirebaseConfigured } from './firebase-config';
import { needsConfig } from './services';

// Oturum başına tek okuma (maliyet ilkesi); okunamazsa varsayılan eşleşme.
let cached: Promise<unknown> | null = null;
const load = () => (cached ??= isFirebaseConfigured ? needsConfig.get().catch(() => ((cached = null), null)) : Promise.resolve(null));

/** Diğer İhtiyaçlar: durum kartı > hizmet kimlikleri (yalnızca listede olan ve etkin kategoriler). */
export function useNeedMap(all: readonly ServiceCategory[]): NeedMap {
  const [raw, setRaw] = useState<unknown>(null);
  useEffect(() => {
    let alive = true;
    load().then((r) => alive && setRaw(r));
    return () => {
      alive = false;
    };
  }, []);
  return useMemo(() => {
    const ids = new Set((all.length ? all : DEFAULT_SERVICE_CATEGORIES).filter((c) => c.active && c.parentId).map((c) => c.id));
    return resolveNeedMap(raw, ids);
  }, [raw, all]);
}
