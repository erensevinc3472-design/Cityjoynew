import locationMeta from '../data/locations/meta.json';

export * from './i18n/languages';
export * from './i18n/resources';
export * from './locations/types';
export * from './locations/search';
export * from './locations/repository';
export * from './models/user';
export * from './models/membership';

/** Konum verisinin sürümü; veri yeniden üretilince değişir ve önbellek yenilenir. */
export const LOCATION_DATA_VERSION: string = locationMeta.generatedAt;
export const LOCATION_DATA_SOURCE: string = locationMeta.source;
export * from './permissions/types';
export * from './permissions/can';
export * from './permissions/role-templates';
