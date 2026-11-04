import { useCallback, useEffect, useState } from 'react';
import { holidayPlaces, type Business, type HolidayCuration, type HolidayPlace, type HolidayTheme } from '@cityjoy/shared';
import { readOpenCountries } from '@cityjoy/shared/firebase';

import { firestore } from './firebase';
import { holidayRepository } from './services';

/**
 * Seyahat > Planla (tatil keşfi). Temanın yerleri ve ildeki konaklama oturum boyunca bir kez okunur (maliyet ilkesi);
 * aşağı çekince yenilenir.
 */
const themeCache = new Map<HolidayTheme, { places: HolidayPlace[]; curation: HolidayCuration }>();
const stayCache = new Map<string, Business[]>();
let countriesCache: string[] | null | undefined;

function useLoad<T>(key: string, read: () => T | undefined, fetch: () => Promise<T>) {
  const [value, setValue] = useState<T | undefined>(read);
  const [failed, setFailed] = useState(false);
  const load = useCallback(
    (force = false) => {
      if (!force && read() !== undefined) return setValue(read());
      setFailed(false);
      fetch().then(setValue, () => setFailed(true));
    },
    [key], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => load(), [load]);
  return { value, failed, reload: () => load(true) };
}

export function useHolidayTheme(theme: HolidayTheme) {
  return useLoad(
    theme,
    () => themeCache.get(theme),
    async () => {
      const [list, curation] = await Promise.all([holidayRepository.listByTheme(theme), holidayRepository.curation(theme)]);
      const v = { places: holidayPlaces(list, curation), curation };
      themeCache.set(theme, v);
      return v;
    },
  );
}

export function useStays(provinceCode: string, theme?: HolidayTheme) {
  const key = `${provinceCode}~${theme ?? ''}`;
  return useLoad(
    key,
    () => stayCache.get(key),
    async () => {
      const list = await holidayRepository.listInProvince(provinceCode, theme);
      stayCache.set(key, list);
      return list;
    },
  );
}

/** Panelden açılan ülkeler (Türkiye dışında). */
export function useOpenCountries() {
  const [open, setOpen] = useState<string[] | null | undefined>(countriesCache);
  useEffect(() => {
    if (countriesCache !== undefined) return;
    readOpenCountries(firestore).then(
      (v) => setOpen((countriesCache = v)),
      () => setOpen(null),
    );
  }, []);
  return open;
}

/** Gece fiyatı aralığı (para birimi metinde): "1.800-4.500" ya da tek değer. */
export function priceRange(min: number | undefined, max: number | undefined, lang: string): string | undefined {
  const f = (n: number) => n.toLocaleString(lang);
  if (min === undefined && max === undefined) return undefined;
  if (min === undefined || max === undefined || min === max) return f((min ?? max)!);
  return `${f(min)}-${f(max)}`;
}
