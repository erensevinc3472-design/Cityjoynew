import { useColorScheme } from 'react-native';

import { colors, type ThemeColors } from './tokens';

export function useThemeColors(): ThemeColors {
  return colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
}
