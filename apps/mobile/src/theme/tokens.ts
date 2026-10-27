/**
 * Görsel kimlik: koyu petrol yeşili ve turkuaz ağırlıklı, altın/bakır vurgu, yuvarlak köşeli kartlar
 * (PROJE.md bölüm 11). GEÇİCİ değerler: tasarım dosyaları gelince stil rehberinden alınan
 * kesin renklerle değiştirilecek.
 */
export const palette = {
  petrol900: '#062A33',
  petrol700: '#0B3C49',
  petrol500: '#145A6B',
  turquoise500: '#14A3A0',
  turquoise100: '#D7F2F1',
  gold500: '#C9A227',
  copper500: '#B87333',
  white: '#FFFFFF',
  gray50: '#F5F7F8',
  gray200: '#DDE3E6',
  gray500: '#6B7A80',
  gray900: '#132126',
  danger: '#C0392B',
} as const;

export const colors = {
  light: {
    background: palette.gray50,
    surface: palette.white,
    text: palette.gray900,
    textMuted: palette.gray500,
    border: palette.gray200,
    primary: palette.petrol700,
    onPrimary: palette.white,
    accent: palette.turquoise500,
    accentSoft: palette.turquoise100,
    highlight: palette.gold500,
    danger: palette.danger,
  },
  dark: {
    background: palette.petrol900,
    surface: '#0D3540',
    text: '#EAF2F4',
    textMuted: '#9DB2B8',
    border: '#1E4A56',
    primary: palette.turquoise500,
    onPrimary: palette.petrol900,
    accent: palette.turquoise500,
    accentSoft: '#12454F',
    highlight: palette.gold500,
    danger: '#E57368',
  },
} as const;

export type ThemeColors = { [K in keyof typeof colors.light]: string };

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

export const fonts = {
  heading: 'PlusJakartaSans_700Bold',
  headingSemi: 'PlusJakartaSans_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
} as const;

/** Dokunma alanı en az 44 nokta (erişilebilirlik). */
export const MIN_TOUCH = 48;
