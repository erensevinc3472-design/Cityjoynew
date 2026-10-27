import { createLocationRepository, LOCATION_DATA_VERSION, type KeyValueCache } from '@cityjoy/shared';

const memory = new Map<string, string>();
const cache: KeyValueCache = {
  get: async (k) => memory.get(k) ?? null,
  set: async (k, v) => void memory.set(k, v),
};

export const locationRepository = createLocationRepository({
  neighbourhoodsBaseUrl: (import.meta.env.VITE_LOCATIONS_BASE_URL ?? './locations/neighbourhoods').replace(/\/$/, ''),
  dataVersion: LOCATION_DATA_VERSION,
  cache,
});
