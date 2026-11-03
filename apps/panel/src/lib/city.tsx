import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import { isGrantActive, type Province } from '@cityjoy/shared';

import { locationRepository } from './locations';
import { useSession } from './session';

interface CityValue {
  /** Seçili il kodu; '' tüm Türkiye (yalnızca ülke yetkisinde). */
  provinceCode: string;
  setProvinceCode(code: string): void;
  /** Ülke yetkisi var mı ("Tüm Türkiye" seçeneği). */
  national: boolean;
  provinces: Province[];
}

const CityContext = createContext<CityValue | null>(null);
const STORAGE_KEY = 'cityjoy-panel-il';

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Üstteki il seçici: seçilen il bütün sayfalara başlangıç süzgeci olur (Karar, Eren, 3 Kasım 2026).
 * Seçenekler kişinin yetkili olduğu illerdir; asıl denetimi veritabanı kuralları yapar.
 */
export function CityProvider({ children }: PropsWithChildren) {
  const { user } = useSession();
  const scopes = (user?.grants ?? []).filter((g) => isGrantActive(g, new Date())).map((g) => g.scope);
  const national = scopes.some((s) => s.level === 'ulke');
  const allowedKey = [...new Set(scopes.flatMap((s) => ('provinceCode' in s && s.provinceCode ? [s.provinceCode] : [])))].sort().join();
  const provinces = useMemo(
    () => locationRepository.getProvinces().filter((p) => national || allowedKey.split(',').includes(p.code)),
    [national, allowedKey],
  );
  const [chosen, setChosen] = useState<string | null>(readStored);
  const valid = (code: string | null): code is string =>
    code !== null && (code === '' ? national : provinces.some((p) => p.code === code));
  const provinceCode = valid(chosen) ? chosen : national ? '' : (provinces[0]?.code ?? '');

  const value: CityValue = {
    provinceCode,
    national,
    provinces,
    setProvinceCode(code) {
      setChosen(code);
      try {
        localStorage.setItem(STORAGE_KEY, code);
      } catch {
        // Tarayıcı saklamaya izin vermiyorsa seçim yalnızca bu oturumda kalır.
      }
    },
  };
  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

export function useCity(): CityValue {
  const value = useContext(CityContext);
  if (!value) throw new Error('useCity CityProvider içinde kullanılmalı');
  return value;
}
