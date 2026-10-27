import { useColorScheme } from 'react-native';

import { useSettings } from '@/lib/settings';
import { colors, type ColorScheme, type ThemeColors } from './tokens';

/** Geçerli renk şeması: kullanıcı sabitlediyse o, yoksa telefonun ayarı. */
export function useResolvedScheme(): ColorScheme {
  const system = useColorScheme();
  const { themeMode } = useSettings();
  if (themeMode !== 'system') return themeMode;
  return system === 'dark' ? 'dark' : 'light';
}

export function useThemeColors(): ThemeColors {
  return colors[useResolvedScheme()];
}
