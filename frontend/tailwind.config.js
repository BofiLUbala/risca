/**
 * Jetons de design RISAC.
 * Couleurs mesurées sur le logo officiel : bleu marine du mot RISAC #123F62,
 * vert #347B4A, jaune #E7B92C, rouge #A73F33, bleu acier #467C92.
 * Le bleu porte l'identité ; les couleurs d'état restent réservées au sens
 * (succès, alerte, danger, confidentialité). Les composants n'inventent aucune couleur locale.
 *
 * @type {import('tailwindcss').Config}
 */

// Bleu de marque. 700 = couleur d'action principale, 800 = bleu du logo.
const risac = {
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
};

// Neutres gris-bleu industriels. 400 et au-delà respectent 4,5:1 sur fond blanc.
const ink = {
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
};

// États sémantiques. Les noms emerald / rose / amber / violet sont redéfinis
// car le code existant les utilise déjà pour les statuts.
const success = {
  50: '#e9f6ef', 100: '#d0eddc', 200: '#a5dcbd', 300: '#6fc597', 400: '#3fab75',
  500: '#23965a', 600: '#1c7d4b', 700: '#17653d', 800: '#145132', 900: '#103f28',
};
const danger = {
  50: '#fdeeed', 100: '#fadbd9', 200: '#f4b8b4', 300: '#ec8b85', 400: '#e1675f',
  500: '#d9574f', 600: '#c2453d', 700: '#a03831', 800: '#822f2a', 900: '#6b2824',
};
const warning = {
  50: '#fdf6e3', 100: '#faeab9', 200: '#f5d97f', 300: '#efc84d', 400: '#e9b937',
  500: '#e6ad28', 600: '#c78d12', 700: '#8a5d0a', 800: '#6e4a0b', 900: '#58390e',
};
// Confidentialité des dossiers sensibles.
const confidential = {
  50: '#f1effa', 100: '#e4e0f5', 200: '#cbc4ea', 300: '#aca1db', 400: '#8a7cc8',
  500: '#7062b4', 600: '#5c4f9c', 700: '#4b4081', 800: '#3d3469', 900: '#322b55',
};
// Accent retenu, réservé à l'information neutre et aux données.
const steel = {
  50: '#e8f4f4', 100: '#cde6e6', 200: '#9fcfcf', 300: '#6bb3b3', 400: '#43a0a0',
  500: '#2d8c8c', 600: '#237272', 700: '#1d5c5c', 800: '#184a4a', 900: '#143d3d',
};

module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        risac,
        ink,
        success,
        danger,
        warning,
        confidential,
        steel,
        // Alias historiques conservés : le code existant les utilise.
        emerald: success,
        rose: danger,
        amber: warning,
        violet: confidential,
        teal: steel,
        accent: {
          mint: success[500],
          amber: warning[500],
          coral: danger[600],
          violet: confidential[500],
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        // Échelle typographique : [taille, { interligne, graisse }]
        'page-title': ['1.5rem', { lineHeight: '2rem', fontWeight: '600', letterSpacing: '-0.015em' }],
        'section-title': ['1rem', { lineHeight: '1.5rem', fontWeight: '600' }],
        'table-head': ['0.75rem', { lineHeight: '1rem', fontWeight: '600', letterSpacing: '0.02em' }],
        meta: ['0.75rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        xl: '0.625rem',
        '2xl': '0.875rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15, 47, 73, 0.05), 0 2px 8px rgba(15, 47, 73, 0.05)',
        lift: '0 2px 4px rgba(15, 47, 73, 0.06), 0 10px 28px rgba(15, 47, 73, 0.12)',
        glow: '0 0 0 4px rgba(23, 74, 112, 0.18)',
        inset: 'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
      },
      backgroundImage: {
        // Dégradé discret réservé aux bandeaux de marque.
        'brand-band': 'linear-gradient(135deg, #0f3352 0%, #174a70 62%, #1d5c8b 100%)',
      },
      transitionDuration: {
        fast: '120ms',
        base: '180ms',
        slow: '260ms',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.24s cubic-bezier(0.2, 0, 0, 1) both',
        'fade-in': 'fade-in 0.18s ease-out both',
        'scale-in': 'scale-in 0.18s cubic-bezier(0.2, 0, 0, 1) both',
        'slide-in-left': 'slide-in-left 0.24s cubic-bezier(0.2, 0, 0, 1) both',
      },
    },
  },
  plugins: [],
};
