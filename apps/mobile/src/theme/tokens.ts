/**
 * Görsel kimlik (docs/stil-rehberi.md). Karar (Eren): koyu modda A "Gece ve Altın",
 * açık modda C "Karma" (koyu üst bant, aydınlık içerik).
 */
export const colors = {
  dark: {
    background: '#0B2328',
    surface: '#123238',
    surfaceStrong: '#163C43',
    border: 'rgba(255, 255, 255, 0.07)',
    text: '#EAF1F1',
    textStrong: '#EAF1F1',
    textMuted: '#A3B9BB',
    textSoft: '#7F9799',
    primary: '#E2B277',
    onPrimary: '#1A1408',
    accent: '#E2B277',
    accentSoft: 'rgba(226, 178, 119, 0.12)',
    accentBorder: 'rgba(226, 178, 119, 0.4)',
    icon: '#E2B277',
    hero: '#0B2328',
    heroText: '#EAF1F1',
    heroMuted: '#A3B9BB',
    heroAccent: '#E2B277',
    heroChip: 'rgba(255, 255, 255, 0.06)',
    highlight: '#E2B277',
    info: '#5FD3DA',
    success: '#4FD1A5',
    successSoft: 'rgba(79, 209, 165, 0.12)',
    danger: '#F87171',
    /** Dolu kırmızı zemin üstündeki yazı (okunaklılık için koyu). */
    onDanger: '#2B0B0B',
    dangerSoft: 'rgba(248, 113, 113, 0.12)',
    notice: 'rgba(226, 178, 119, 0.10)',
    noticeBorder: 'rgba(226, 178, 119, 0.35)',
    shadow: 'transparent',
  },
  light: {
    background: '#F4F5F1',
    surface: '#FFFFFF',
    surfaceStrong: '#FFFFFF',
    border: '#E3E8E6',
    text: '#14262B',
    textStrong: '#14262B',
    textMuted: '#56696D',
    textSoft: '#7A8B8E',
    primary: '#0E4F57',
    onPrimary: '#FFFFFF',
    accent: '#0E4F57',
    accentSoft: '#E3EEEC',
    accentBorder: 'rgba(14, 79, 87, 0.35)',
    icon: '#0E4F57',
    hero: '#0B2E33',
    heroText: '#F1F5F4',
    heroMuted: '#A9C0C1',
    heroAccent: '#E2B277',
    heroChip: 'rgba(255, 255, 255, 0.08)',
    highlight: '#B9802F',
    info: '#0E7C86',
    success: '#16855F',
    successSoft: '#E2F3EB',
    danger: '#C0392B',
    onDanger: '#FFFFFF',
    dangerSoft: '#FBE9E7',
    notice: '#FFF6E8',
    noticeBorder: '#F0D2A2',
    shadow: 'rgba(20, 38, 43, 0.08)',
  },
} as const;

export type ColorScheme = keyof typeof colors;
export type ThemeColors = { [K in keyof typeof colors.dark]: string };

export const spacing = { xs: 4, sm: 8, md: 14, lg: 20, xl: 28 } as const;
/** Ekran kenar boşluğu. */
export const GUTTER = 16;
export const radius = { sm: 10, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export const fonts = {
  /** Profil adı gibi öne çıkan tek satırlık başlıklar. */
  display: 'PlusJakartaSans_800ExtraBold',
  heading: 'PlusJakartaSans_700Bold',
  headingSemi: 'PlusJakartaSans_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
} as const;

/** Dokunma alanı en az 44 nokta (erişilebilirlik). */
export const MIN_TOUCH = 44;
