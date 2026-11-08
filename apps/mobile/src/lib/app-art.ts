/**
 * Uygulamaya gömülü resimler: Eren'in ChatGPT ile hazırladığı seri (8 Kasım 2026; kaynaklar masaüstündeki
 * CityJoy-gorseller klasöründe, tarifler docs/gorsel-listesi.md). Her ilde aynıdır. Panel > Uygulama görselleri
 * (Blaze ile) gelince giriş resimleri oradan değiştirilebilecek; bunlar varsayılan olarak kalır.
 */
export const HOME_ART = {
  myCity: require('../../assets/home/sehrim.jpg') as number,
  travel: require('../../assets/home/seyahat.jpg') as number,
  social: require('../../assets/home/sosyal.jpg') as number,
  urgent: require('../../assets/home/acil.jpg') as number,
};

export const AUTH_ART = {
  welcome: require('../../assets/auth/karsilama.jpg') as number,
  language: require('../../assets/auth/dil.jpg') as number,
  /** Dil seçiminin arka planı: üstte balonlar, ortası boş, altta şehir (Eren, 8 Kasım 2026). */
  languageBg: require('../../assets/auth/dil-arka.jpg') as number,
  permission: require('../../assets/auth/izin.jpg') as number,
};

/** Dil seçimi satırlarının resimleri (Eren, 8 Kasım 2026): konu sağda, sol taraf koyu petrol yeşiline eriyor. */
export const LANGUAGE_ART = {
  tr: require('../../assets/lang/tr.jpg') as number,
  en: require('../../assets/lang/en.jpg') as number,
  de: require('../../assets/lang/de.jpg') as number,
  ru: require('../../assets/lang/ru.jpg') as number,
  ar: require('../../assets/lang/ar.jpg') as number,
};
