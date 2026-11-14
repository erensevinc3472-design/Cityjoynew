import { Platform } from 'react-native';

/**
 * Panel > Uygulama görünümü: uygulamanın web derlemesi panelin içinde, telefon çerçevesinde açılır
 * (EXPO_PUBLIC_PANEL_PREVIEW=1 ile derlenir, `/uygulama/` altında). Bu derlemede uygulama yalnızca okur, kayıt yapmaz.
 * Telefondaki uygulamada ve normal web sürümünde bu değer her zaman false'tur.
 */
export const IS_PANEL_PREVIEW = Platform.OS === 'web' && process.env.EXPO_PUBLIC_PANEL_PREVIEW === '1';
