/**
 * Memes jetons de design que l application web (frontend/tailwind.config.js) :
 * couleurs mesurees sur le logo officiel RISAC (bleu marine #123F62), neutres gris-bleu
 * industriels, coins moins arrondis, ombres discretes.
 * Les couleurs d etat sont reservees au sens : succes, alerte, danger, confidentialite.
 */
export const colors = {
  risac: {
    50: '#eef4f9',
    100: '#dce8f1',
    200: '#bdd3e4',
    300: '#90b4d0',
    400: '#5d8fb5',
    500: '#2f6f9f',
    600: '#1d5c8b',
    700: '#174a70',
    800: '#123f62',
    900: '#0f3352',
    950: '#0b2740',
  },
  ink: {
    50: '#f3f6f9',
    100: '#e8edf2',
    200: '#d9e1e8',
    300: '#bcc8d3',
    400: '#5f7185',
    500: '#4f6175',
    600: '#41536a',
    700: '#33455b',
    800: '#2b3b4d',
    900: '#263746',
    950: '#172430',
  },
  white: '#ffffff',
  mint: '#23965a',
  mintSoft: '#e9f6ef',
  amber: '#e6ad28',
  amberSoft: '#fdf6e3',
  coral: '#c2453d',
  coralSoft: '#fdeeed',
  violet: '#7062b4',
  violetSoft: '#f1effa',
  // Textes d'etat sur fond clair : contraste >= 4,5:1.
  mintText: '#17653d',
  amberText: '#8a5d0a',
  coralText: '#a03831',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 12,
  xl: 14,
  '2xl': 20,
  full: 999,
};

export const typography = {
  display: { fontSize: 26, fontWeight: '600' as const, letterSpacing: -0.4 },
  title: { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.3 },
  heading: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyMedium: { fontSize: 15, fontWeight: '500' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 11, fontWeight: '500' as const },
};

export const shadow = {
  soft: {
    shadowColor: '#0f2f49',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  lift: {
    shadowColor: '#0f2f49',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
};

/** Teintes de statut, alignees sur le web. */
export function statusTone(status?: string): { bg: string; fg: string } {
  switch (status) {
    case 'ACTIVE':
    case 'APPROVED':
    case 'COMPLIANT':
    case 'PUBLISHED':
    case 'SETTLED':
    case 'PAID':
    case 'RESOLVED':
      return { bg: colors.mintSoft, fg: '#17653d' };
    case 'IN_VALIDATION':
    case 'PENDING':
    case 'REQUESTED':
    case 'AMBASSADOR_CONFIRMED':
    case 'IN_PROGRESS':
      return { bg: colors.risac[50], fg: colors.risac[700] };
    case 'NEEDS_CORRECTION':
    case 'CHANGES_REQUESTED':
    case 'COMPLIANT_WITH_CONDITIONS':
    case 'AWAITING_RECEIPTS':
    case 'PAUSED':
      return { bg: colors.amberSoft, fg: '#8a5d0a' };
    case 'REJECTED':
    case 'BLOCKED':
    case 'NON_COMPLIANT':
    case 'FROZEN':
    case 'CANCELLED':
      return { bg: colors.coralSoft, fg: '#a03831' };
    default:
      return { bg: colors.ink[100], fg: colors.ink[600] };
  }
}
