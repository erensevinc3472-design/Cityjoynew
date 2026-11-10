import { useEffect, useState } from 'react';
import { pickSponsor, type Sponsor, type SponsorPlace } from '@cityjoy/shared';

import { sponsorRepository } from './services';

/** İlin sponsorları oturumda bir kez okunur (maliyet ilkesi); tarih ve açıklık telefonda süzülür. */
const cache = new Map<string, Promise<Sponsor[]>>();

export function useSponsor(provinceCode: string | undefined, place: SponsorPlace): Sponsor | undefined {
  const [list, setList] = useState<Sponsor[]>([]);
  useEffect(() => {
    if (!provinceCode) return setList([]);
    let p = cache.get(provinceCode);
    if (!p) {
      p = sponsorRepository.listFor(provinceCode).catch(() => {
        cache.delete(provinceCode);
        return [];
      });
      cache.set(provinceCode, p);
    }
    let live = true;
    p.then((l) => live && setList(l));
    return () => {
      live = false;
    };
  }, [provinceCode]);
  return provinceCode ? pickSponsor(list, provinceCode, place) : undefined;
}

/**
 * Anket ve yarışma listesi için küçük önbellek (Sosyal Harmoni şeridi): il başına 5 dakika. Liste ekranları kendi
 * okumasını yapar; şerit yalnızca kart ortaya gelince bir kez okur.
 */
const lists = new Map<string, { at: number; p: Promise<unknown[]> }>();
export function useCachedList<T>(key: string | undefined, load: () => Promise<T[]>): T[] | null {
  const [list, setList] = useState<T[] | null>(null);
  useEffect(() => {
    if (!key) return setList([]);
    let hit = lists.get(key);
    if (!hit || Date.now() - hit.at > 5 * 60 * 1000) {
      hit = { at: Date.now(), p: load().catch(() => (lists.delete(key), [])) };
      lists.set(key, hit);
    }
    let live = true;
    hit.p.then((l) => live && setList(l as T[]));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return list;
}
