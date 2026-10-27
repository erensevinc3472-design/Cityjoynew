/**
 * Görsel kimlik: Eren'in tasarımlarından çıkarılan değerler (docs/stil-rehberi.md).
 * Koyu petrol yeşili zemin, yarı saydam kartlar, ana vurgu altın, ikinci vurgu turkuaz.
 */
export const palette = {
  deep: '#081F24',
  base: '#0B2B2D',
  card: '#17464B',
  cardDark: '#0D3238',
  edge: '#3F6E70',
  text: '#C7D8DA',
  textStrong: '#EEF4F4',
  textSecondary: '#9FB6B8',
  textMuted: '#6E8C8E',
  gold: '#E0B07A',
  goldDeep: '#D9A066',
  cyan: '#25C6CF',
  green: '#10B981',
  red: '#EF4444',
} as const;

export const colors = {
  dark: {
    background: palette.deep,
    surface: 'rgba(23, 70, 75, 0.75)',
    surfaceStrong: palette.cardDark,
    text: palette.text,
    textStrong: palette.textStrong,
    textMuted: palette.textSecondary,
    border: 'rgba(63, 110, 112, 0.4)',
    primary: palette.gold,
    onPrimary: palette.deep,
    accent: palette.gold,
    accentSoft: 'rgba(224, 176, 122, 0.15)',
    accentBorder: 'rgba(224, 176, 122, 0.4)',
    highlight: palette.gold,
    info: palette.cyan,
    success: palette.green,
    danger: '#F87171',
  },
  /**
   * Açık tema tasarımlarda yok. Eren karar verene kadar kullanılmıyor (docs/stil-rehberi.md, açık soru).
   */
  light: {
    background: '#F4F7F7',
    surface: '#FFFFFF',
    surfaceStrong: '#E8EFEF',
    text: '#132126',
    textStrong: '#081F24',
    textMuted: '#4F6468',
    border: '#D5E0E1',
    primary: '#0B3C49',
    onPrimary: '#FFFFFF',
    accent: '#A9742F',
    accentSoft: 'rgba(224, 176, 122, 0.2)',
    accentBorder: 'rgba(169, 116, 47, 0.5)',
    highlight: '#A9742F',
    info: '#0E8C93',
    success: '#0F7B57',
    danger: '#C0392B',
  },
} as const;

export type ThemeColors = { [K in keyof typeof colors.dark]: string };

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 12, md: 16, lg: 20, xl: 24, pill: 999 } as const;

export const fonts = {
  heading: 'PlusJakartaSans_700Bold',
  headingSemi: 'PlusJakartaSans_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  /** Slogan vurgusu ("Senin Keyfin"). */
  accentSerif: 'PlayfairDisplay_500Medium_Italic',
} as const;

/** Dokunma alanı en az 44 nokta (erişilebilirlik). */
export const MIN_TOUCH = 48;
