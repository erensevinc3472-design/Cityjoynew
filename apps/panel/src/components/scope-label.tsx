import { useEffect, useState } from 'react';
import type { RegionScope } from '@cityjoy/shared';

import { locationRepository as repo } from '../lib/locations';
import { scopeLabel } from '../lib/scope-label';

/** Yetki bölgesinin okunur adı; mahalle adı ilk kullanımda indirilir. */
export function ScopeLabel({ scope }: { scope: RegionScope }) {
  const [neighbourhood, setNeighbourhood] = useState<string>();
  useEffect(() => {
    if (scope.level !== 'mahalle') return;
    repo
      .getNeighbourhoods(scope.districtId)
      .then((list) => setNeighbourhood(list.find((n) => n.id === scope.neighbourhoodId)?.name))
      .catch(() => {});
  }, [scope]);
  return <>{scopeLabel(scope, neighbourhood)}</>;
}
