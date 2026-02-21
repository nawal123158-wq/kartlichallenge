export const theme = {
  colors: {
    primary: '#6366F1',
    primaryLight: '#818CF8',
    primaryDark: '#4F46E5',

    secondary: '#EC4899',
    secondaryLight: '#F472B6',

    accent: '#22D3EE',
    gold: '#FBBF24',

    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',

    background: '#0B1220',
    backgroundElevated: '#0F172A',
    backgroundLight: '#0F172A',

    surface: '#111C33',
    surfaceElevated: '#172554',
    card: '#111C33',
    cardLight: '#172554',

    text: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textMuted: '#94A3B8',

    border: 'rgba(148,163,184,0.18)',

    // Deck colors
    deck: {
      komik: '#F97316',
      sosyal: '#06B6D4',
      beceri: '#8B5CF6',
      cevre: '#22C55E',
      ceza: '#EF4444',
    },
  },

  radius: {
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
  },

  spacing: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
  },

  typography: {
    h1: { fontSize: 28, fontWeight: '800' as const },
    h2: { fontSize: 22, fontWeight: '800' as const },
    h3: { fontSize: 18, fontWeight: '700' as const },
    body: { fontSize: 16, fontWeight: '500' as const },
    caption: { fontSize: 12, fontWeight: '600' as const },
  },
};

export type AppTheme = typeof theme;

export const COLORS = {
  ...theme.colors,
  komik: theme.colors.deck.komik,
  sosyal: theme.colors.deck.sosyal,
  beceri: theme.colors.deck.beceri,
  cevre: theme.colors.deck.cevre,
  ceza: theme.colors.deck.ceza,
};
