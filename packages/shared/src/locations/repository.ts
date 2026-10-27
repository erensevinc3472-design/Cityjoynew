import districtsData from '../../data/locations/districts.json';
import provincesData from '../../data/locations/provinces.json';
import type { District, Neighbourhood, Province } from './types';

/** Basit anahtar-değer önbelleği (mobilde AsyncStorage, testte bellek). */
export interface KeyValueCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface LocationRepository {
  getProvinces(): Province[];
  getProvince(code: string): Province | undefined;
  getDistricts(provinceCode: string): District[];
  getDistrict(id: string): District | undefined;
  /** İlin mahalleleri veri havuzundan bir kez indirilir, sonra önbellekten okunur. */
  getNeighbourhoods(districtId: string): Promise<Neighbourhood[]>;
}

export interface LocationRepositoryOptions {
  /** Mahalle dosyalarının bulunduğu adres, örn. "https://.../locations/neighbourhoods". */
  neighbourhoodsBaseUrl: string;
  /** Veri sürümü; değişince önbellek yenilenir. */
  dataVersion: string;
  cache: KeyValueCache;
  fetchJson?: (url: string) => Promise<unknown>;
}

type ProvinceNeighbourhoods = Record<string, Neighbourhood[]>;

const provinces = provincesData as Province[];
const districts = districtsData as District[];

const defaultFetchJson = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Konum verisi alınamadı (${res.status})`);
  return res.json();
};

export function createLocationRepository(options: LocationRepositoryOptions): LocationRepository {
  const { neighbourhoodsBaseUrl, dataVersion, cache, fetchJson = defaultFetchJson } = options;
  const inMemory = new Map<string, Promise<ProvinceNeighbourhoods>>();

  async function loadProvince(code: string): Promise<ProvinceNeighbourhoods> {
    const key = `locations:${dataVersion}:neighbourhoods:${code}`;
    const cached = await cache.get(key);
    if (cached) return JSON.parse(cached) as ProvinceNeighbourhoods;
    const data = (await fetchJson(`${neighbourhoodsBaseUrl}/${code}.json`)) as ProvinceNeighbourhoods;
    await cache.set(key, JSON.stringify(data));
    return data;
  }

  return {
    getProvinces: () => provinces,
    getProvince: (code) => provinces.find((p) => p.code === code),
    getDistricts: (provinceCode) => districts.filter((d) => d.provinceCode === provinceCode),
    getDistrict: (id) => districts.find((d) => d.id === id),
    async getNeighbourhoods(districtId) {
      const code = districtId.slice(0, 2);
      let pending = inMemory.get(code);
      if (!pending) {
        pending = loadProvince(code);
        inMemory.set(code, pending);
        pending.catch(() => inMemory.delete(code));
      }
      return (await pending)[districtId] ?? [];
    },
  };
}
