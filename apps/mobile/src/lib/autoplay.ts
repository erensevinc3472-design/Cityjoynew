import { useNetInfo } from '@react-native-community/netinfo';
import { Platform } from 'react-native';

import { useSettings } from './settings';

/**
 * Keşfet videosu şu an kendiliğinden oynayabilir mi: ayar "Her zaman" ise evet, "Kapalı" ise hayır, "Yalnızca Wi-Fi"
 * (varsayılan) ise telefon Wi-Fi ya da kabloluysa. Oynamayan video dokununca tam ekranda yine oynar.
 */
export function useAutoplayAllowed(): boolean {
  const { autoplay } = useSettings();
  const { type } = useNetInfo();
  if (autoplay === 'kapali') return false;
  if (autoplay === 'her-zaman') return true;
  return type === 'wifi' || type === 'ethernet' || Platform.OS === 'web';
}
