import { colors, type ThemeColors } from './tokens';

/** Tasarımlar koyu temalı; açık tema kararı Eren'de (docs/stil-rehberi.md). */
export const COLOR_SCHEME: 'dark' | 'light' = 'dark';

export function useThemeColors(): ThemeColors {
  return colors[COLOR_SCHEME];
}
