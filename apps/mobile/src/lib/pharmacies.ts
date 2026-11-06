import { useEffect, useState } from 'react';
import type { DutyPharmacyDay } from '@cityjoy/shared';

import { pharmacyRepository } from './services';

/** İl başına tek okuma; 30 dakika telefonda (liste günde bir değişir; maliyet ilkesi). */
const cache = new Map<string, { at: number; day: DutyPharmacyDay | null }>();
const TTL = 30 * 60 * 1000;

export function useDutyPharmacies(provinceCode: string | undefined) {
  const hit = provinceCode ? cache.get(provinceCode) : undefined;
  const [day, setDay] = useState<DutyPharmacyDay | null | undefined>(hit ? hit.day : undefined);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!provinceCode) return setDay(null);
    const h = cache.get(provinceCode);
    if (h && Date.now() - h.at < TTL) return setDay(h.day);
    setFailed(false);
    pharmacyRepository.get(provinceCode).then(
      (d) => {
        cache.set(provinceCode, { at: Date.now(), day: d });
        setDay(d);
      },
      () => setFailed(true),
    );
  }, [provinceCode]);
  return { day, failed };
}
