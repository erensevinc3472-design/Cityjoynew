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
export * from './permissions/grants';
export * from './organizations/types';
export * from './organizations/staff';
export * from './organizations/municipalities';
export * from './organizations/profiles';
export * from './services/types';
export * from './services/occupations';
export * from './emergency/numbers';
export * from './categories/service-categories';
export * from './business/business';
export * from './business/reviews';
export * from './sos/sos';
export * from './city-guide/schema';
export * from './city-guide/items';
export * from './models/sign-up';
export * from './approvals/approvals';
export * from './announcements/announcements';
export * from './events/events';
