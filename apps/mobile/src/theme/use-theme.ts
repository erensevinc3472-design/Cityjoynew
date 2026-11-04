import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

import { useSettings } from '@/lib/settings';
import { colors, type ColorScheme, type ThemeColors } from './tokens';

/**
 * Bir bölümün renk şemasını sabitler: giriş ve izin ekranları her zaman koyu sahne üstündedir. `glass` açıksa
 * form alanları yarı saydam cam görünümünü alır (13. madde 35, giriş akışı).
 */
export const SurfaceContext = createContext<{ scheme: ColorScheme; glass?: boolean } | null>(null);

/** Geçerli renk şeması: bölüm sabitlediyse o, kullanıcı sabitlediyse o, yoksa telefonun ayarı. */
export function useResolvedScheme(): ColorScheme {
  const system = useColorScheme();
  const { themeMode } = useSettings();
  const forced = useContext(SurfaceContext);
  if (forced) return forced.scheme;
  if (themeMode !== 'system') return themeMode;
  return system === 'dark' ? 'dark' : 'light';
}

export function useThemeColors(): ThemeColors {
  return colors[useResolvedScheme()];
}

export const useGlass = () => !!useContext(SurfaceContext)?.glass;
