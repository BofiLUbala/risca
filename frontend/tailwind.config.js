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
// Alerte : orange, volontairement distinct du jaune de marque pour que
// « attention » ne se confonde jamais avec la couleur d'accent.
const warning = {
  50: '#fff5eb', 100: '#ffe6cc', 200: '#fdcb96', 300: '#fbab5c', 400: '#f68f32',
  500: '#e8751a', 600: '#c45c10', 700: '#9a460e', 800: '#7a3911', 900: '#622f11',
};
// Jaune du logo (#E7B92C) : accent de marque. 400 = jaune du logo.
// Toujours en aplat ou en trait, jamais en texte sur fond blanc (contraste 1,9:1) ;
// texte posé dessus : ink-950. Sur le bleu marine, le jaune 400 passe 6:1.
const sun = {
  50: '#fdf8e6', 100: '#fbefc0', 200: '#f6df85', 300: '#f0cd4e', 400: '#e7b92c',
  500: '#d1a11a', 600: '#a87e10', 700: '#7f5d0f', 800: '#5f4510', 900: '#4a3610',
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


// ---------- Thèmes clair et sombre ----------
// Chaque échelle est exposée en variables CSS (`--c-<nom>-<teinte>`), définies par
// le plugin plus bas : `:root` pour le clair, `.dark` pour le sombre. Les classes
// Tailwind (`bg-ink-50`, `text-risac-700`...) suivent donc le thème sans changer.
const reverseScale = (s) => {
  const keys = Object.keys(s);
  const vals = Object.values(s);
  return Object.fromEntries(keys.map((k, i) => [k, vals[keys.length - 1 - i]]));
};
const hexToRgb = (h) =>
  [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ');

// Sombre : neutres relevés à la main pour garder un texte secondaire lisible (> 4,5:1).
const inkDark = {
  50: '#0e1822', 100: '#1a2a38', 200: '#263a4c', 300: '#3a5064', 400: '#9fb1c3',
  500: '#aebfce', 600: '#c1cfdb', 700: '#d2dde7', 800: '#e1e9f0', 900: '#edf2f7', 950: '#f7fafc',
};
const risacDark = {
  50: '#11263a', 100: '#163450', 200: '#1d4766', 300: '#2a6190', 400: '#5d8fb5',
  500: '#7fb0d6', 600: '#9cc4e4', 700: '#b8d6ee', 800: '#cfe3f4', 900: '#e2eef8', 950: '#f0f7fc',
};
const sunDark = {
  50: '#2a2310', 100: '#3a2f12', 200: '#55431a', 300: sun[300], 400: sun[400],
  500: sun[500], 600: '#f0cd4e', 700: '#f6df85', 800: '#fbefc0', 900: '#fdf8e6',
};

const PALETTES = {
  ink: [ink, inkDark],
  risac: [risac, risacDark],
  sun: [sun, sunDark],
  success: [success, reverseScale(success)],
  danger: [danger, reverseScale(danger)],
  warning: [warning, reverseScale(warning)],
  confidential: [confidential, reverseScale(confidential)],
  steel: [steel, reverseScale(steel)],
};
const themed = (name) =>
  Object.fromEntries(
    Object.keys(PALETTES[name][0]).map((k) => [k, `rgb(var(--c-${name}-${k}) / <alpha-value>)`]),
  );
const cssVars = (mode) => {
  const out = {};
  for (const [name, pair] of Object.entries(PALETTES)) {
    for (const [k, v] of Object.entries(pair[mode])) out[`--c-${name}-${k}`] = hexToRgb(v);
  }
  out['--surface'] = mode === 0 ? '255 255 255' : '21 33 44';
  return out;
};

const plugin = require('tailwindcss/plugin');

module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  // Classes de thème du menu construites dynamiquement (`sb-${color}`) : à conserver.
  safelist: ['sb-light', 'sb-navy', 'sb-green', 'sb-steel', 'sb-dark'],
  theme: {
    extend: {
      colors: {
        risac: themed('risac'),
        sun: themed('sun'),
        ink: themed('ink'),
        success: themed('success'),
        danger: themed('danger'),
        warning: themed('warning'),
        confidential: themed('confidential'),
        steel: themed('steel'),
        // Fonds de carte : blanc en clair, bleu nuit en sombre.
        surface: 'rgb(var(--surface) / <alpha-value>)',
        // Couleurs qui ne s'inversent jamais : texte sur le jaune, aplats de marque, alertes pleines.
        navy: '#172430',
        onband: '#dce8f1',
        brand: { 600: '#1d5c8b', 700: '#174a70' },
        alert: { 600: '#c2453d', 700: '#a03831', 800: '#822f2a' },
        // Alias historiques conservés : le code existant les utilise.
        emerald: themed('success'),
        rose: themed('danger'),
        amber: themed('warning'),
        violet: themed('confidential'),
        teal: themed('steel'),
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
        glow: '0 0 0 4px rgba(231, 185, 44, 0.35)',
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
  plugins: [
    plugin(({ addBase }) => {
      addBase({ ':root': cssVars(0), '.dark': { ...cssVars(1), colorScheme: 'dark' } });
    }),
  ],
};
