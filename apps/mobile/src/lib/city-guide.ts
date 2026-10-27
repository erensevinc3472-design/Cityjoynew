import { useCallback, useEffect, useState } from 'react';
import { NATIONAL, type CityGuideItem, type CityGuideMeta, type CityGuideSectionId } from '@cityjoy/shared';

import { isFirebaseConfigured } from './firebase-config';
import { cityGuide } from './services';

/**
 * İlin bölüm özeti: önce telefonda saklı olan, sonra sunucudan tek okumayla tazesi. İnternet yoksa saklı olanla
 * devam edilir ve "güncel olmayabilir" notu gösterilir (PROJE.md 9.1).
 */
export function useCityGuideMeta(provinceCode: string | undefined) {
  const [meta, setMeta] = useState<CityGuideMeta | null>(null);
  const [stale, setStale] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!provinceCode) return;
    let alive = true;
    let fresh = false;
    setMeta(null);
    setFailed(false);
    cityGuide.cachedMeta(provinceCode).then((m) => alive && !fresh && m && setMeta(m));
    if (!isFirebaseConfigured) return;
    cityGuide
      .refreshMeta(provinceCode)
      .then((m) => {
        fresh = true;
        if (!alive) return;
        setMeta(m);
        setStale(false);
      })
      .catch(async () => {
        if (!alive) return;
        const cached = await cityGuide.cachedMeta(provinceCode);
        setStale(true);
        if (!cached) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [provinceCode]);

  return { meta, stale, failed };
}

/**
 * Bir bölümün öğeleri. "Nasıl yapılır?" rehberinde ilin kendi içeriğine ülke geneli içerik de eklenir.
 * Döner: null = yükleniyor.
 */
export function useCityGuideItems(provinceCode: string | undefined, section: CityGuideSectionId) {
  const { meta, stale, failed } = useCityGuideMeta(provinceCode);
  const national = useCityGuideMeta(section === 'nasil-yapilir' ? NATIONAL : undefined);
  const [items, setItems] = useState<CityGuideItem[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!provinceCode || !meta) return;
    if (section === 'nasil-yapilir' && !national.meta && !national.failed) return;
    let alive = true;
    setError(false);
    const load = async (p: string, m: CityGuideMeta) => {
      try {
        return await cityGuide.items(p, section, m);
      } catch {
        const cached = await cityGuide.cachedItems(p, section);
        if (!cached.length) throw new Error('yok');
        return cached;
      }
    };
    Promise.all([load(provinceCode, meta), section === 'nasil-yapilir' && national.meta ? load(NATIONAL, national.meta) : Promise.resolve([])])
      .then(([own, nat]) => alive && setItems([...own, ...nat]))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [provinceCode, section, meta, national.meta, national.failed, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { items: failed && !meta ? [] : items, stale, error: error || (failed && !meta), retry, meta };
}
