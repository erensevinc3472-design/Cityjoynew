import type { AppImage } from '@cityjoy/shared';

/**
 * Uygulamadaki hazır resimlerin panelde küçük önizlemesi (Panel > Uygulama ayarları > Görseller). Dosyalar uygulamanın
 * kendi klasöründen alınır (apps/mobile/assets); eşleme apps/mobile/src/lib/app-art.ts ile aynı olmalı. `null`: uygulamada
 * hazır resim yok, yerine çizim çıkar.
 */
const FILES = import.meta.glob('../../../mobile/assets/{auth,lang,home,travel,city,social}/*.jpg', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;

const FILE_OF: Record<AppImage, string | null> = {
  welcome: 'auth/karsilama',
  welcomeLanguage: 'auth/dil',
  permission: 'auth/izin',
  language: 'auth/dil-arka',
  signIn: 'auth/karsilama',
  langTr: 'lang/tr',
  langEn: 'lang/en',
  langDe: 'lang/de',
  langAr: 'lang/ar',
  langRu: 'lang/ru',
  homeMyCity: 'home/sehrim',
  homeTravel: 'home/seyahat',
  homeSocial: 'home/sosyal',
  homeUrgent: 'home/acil',
  travelJourney: 'travel/yolculuk',
  travelExplore: 'travel/kesfet',
  cityTownhall: 'city/belediye',
  cityInstitutions: 'city/kurumlar',
  cityNeighbourhood: 'city/mahalle',
  cityShowcase: 'city/vitrin',
  citySkyline: 'city/siluet',
  socialEvents: 'social/etkinlikler',
  socialActivities: 'social/aktiviteler',
  socialNews: 'social/haberler',
  socialContests: 'social/yarismalar',
  socialPolls: 'social/anketler',
  dealFood: 'social/yemek',
  dealMarket: 'social/market',
  dealSport: null,
  dealFun: 'social/eglence',
  dealCraft: 'social/zanaat',
  dealHealth: null,
  dealEducation: 'social/egitim',
};

/** Hazır resmin adresi (panelde gösterim için); yoksa null. */
export function defaultImageUrl(key: AppImage): string | null {
  const f = FILE_OF[key];
  return f ? (FILES[`../../../mobile/assets/${f}.jpg`] ?? null) : null;
}
