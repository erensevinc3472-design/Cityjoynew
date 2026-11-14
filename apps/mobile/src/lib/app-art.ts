import { useReducer } from 'react';
import type { AppImage } from '@cityjoy/shared';

import { useAppConfig } from './app-config';

/**
 * Uygulamaya gömülü hazır resimler: Eren'in ChatGPT ile hazırladığı seri (8-12 Kasım 2026; kaynaklar masaüstündeki
 * CityJoy-gorseller klasöründe, tarifler docs/gorsel-listesi.md). Her ilde aynıdır.
 * Hepsi Panel > Uygulama ayarları > Görseller'den değiştirilebilir (Eren, 14 Kasım 2026): panelde resim yüklenmişse o
 * gösterilir, yoksa ya da açılamazsa buradaki hazır resim. `null`: hazır resim yok, yerine çizim (SceneArt) çıkar.
 * Anahtarlar ve önerilen boyutlar: packages/shared/src/app-config/app-config.ts (APP_IMAGE_SPECS).
 */
export const ART: Record<AppImage, number | null> = {
  welcome: require('../../assets/auth/karsilama.jpg'),
  welcomeLanguage: require('../../assets/auth/dil.jpg'),
  permission: require('../../assets/auth/izin.jpg'),
  /** Dil seçiminin arka planı: üstte balonlar, ortası boş, altta şehir (Eren, 8 Kasım 2026). */
  language: require('../../assets/auth/dil-arka.jpg'),
  signIn: require('../../assets/auth/karsilama.jpg'),
  /** Dil seçimi satırları (Eren, 8 Kasım 2026): konu sağda, sol taraf koyu petrol yeşiline eriyor. */
  langTr: require('../../assets/lang/tr.jpg'),
  langEn: require('../../assets/lang/en.jpg'),
  langDe: require('../../assets/lang/de.jpg'),
  langAr: require('../../assets/lang/ar.jpg'),
  langRu: require('../../assets/lang/ru.jpg'),
  /** Şehrim (ada) 10 Kasım, Seyahat (bavul), Sosyal (park masası) ve Acil (ilk yardım çantası) 12 Kasım 2026. */
  homeMyCity: require('../../assets/home/sehrim.jpg'),
  homeTravel: require('../../assets/home/seyahat.jpg'),
  homeSocial: require('../../assets/home/sosyal.jpg'),
  homeUrgent: require('../../assets/home/acil.jpg'),
  /** Seyahat girişinin iki yarısı (Eren, 11 Kasım 2026): altta valiz ve telefon (Yolculuk), üstte eski harita (Keşfet). */
  travelJourney: require('../../assets/travel/yolculuk.jpg'),
  travelExplore: require('../../assets/travel/kesfet.jpg'),
  cityTownhall: require('../../assets/city/belediye.jpg'),
  cityInstitutions: require('../../assets/city/kurumlar.jpg'),
  cityNeighbourhood: require('../../assets/city/mahalle.jpg'),
  cityShowcase: require('../../assets/city/vitrin.jpg'),
  /** Sayfa sonlarındaki şehir silüeti (8 Kasım 2026; kaynak CityJoy-gorseller/siluet.png). */
  citySkyline: require('../../assets/city/siluet.jpg'),
  /** Sosyal Harmoni ve Fırsatlar kartları (Eren, 11 Kasım 2026; asılları CityJoy-gorseller/sosyal-harmoni). */
  socialEvents: require('../../assets/social/etkinlikler.jpg'),
  socialActivities: require('../../assets/social/aktiviteler.jpg'),
  socialNews: require('../../assets/social/haberler.jpg'),
  socialContests: require('../../assets/social/yarismalar.jpg'),
  socialPolls: require('../../assets/social/anketler.jpg'),
  dealFood: require('../../assets/social/yemek.jpg'),
  dealMarket: require('../../assets/social/market.jpg'),
  dealSport: null,
  dealFun: require('../../assets/social/eglence.jpg'),
  dealCraft: require('../../assets/social/zanaat.jpg'),
  dealHealth: null,
  dealEducation: require('../../assets/social/egitim.jpg'),
};

export type ArtSource = { source: number | { uri: string }; onError?: () => void };

/** Açılamayan panel adresleri (oturum boyunca): bir kez bozuk çıkan adres her ekranda hazır resme döner. */
const failed = new Set<string>();

/**
 * Resim çözücü: `art('homeTravel')` panel resmini (adres), yoksa hazır resmi verir; ikisi de yoksa null (çizim).
 * Panel resmi indirildikten sonra telefonda saklanır (expo-image önbelleği), her açılışta yeniden indirilmez.
 */
export function useArt(): (key: AppImage) => ArtSource | null {
  const images = useAppConfig().images;
  const [, bump] = useReducer((n: number) => n + 1, 0);
  return (key) => {
    const url = images[key];
    if (url && !failed.has(url)) {
      return {
        source: { uri: url },
        onError: () => {
          failed.add(url);
          bump();
        },
      };
    }
    const local = ART[key];
    return local ? { source: local } : null;
  };
}

