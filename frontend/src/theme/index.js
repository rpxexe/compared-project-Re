import { Platform } from 'react-native';

export const colors = {
  ink: '#17133B', plum: '#2A1060', charcoal: '#1B1233',
  ivory: '#FBF9FF', champagneSoft: '#EBE2FF', lavender: '#E4DBFA',
  gold: '#8B5CF6', goldDeep: '#6D28D9', rose: '#C77DFF',
  success: '#0E9F6E', error: '#D32F2F',
  white: '#FFFFFF', line: '#E9E0F8', muted: '#6D6885', text: '#1E1238',
  overlay: 'rgba(20,10,46,0.55)',
  neon: '#C77DFF', violet: '#7C3AED', deepViolet: '#0B0420',
  primary: '#7C3AED', primaryLight: '#8B5CF6', primaryDark: '#6D28D9',
  purpleSurface: '#F5EFFF', purpleBorder: 'rgba(139, 92, 246, 0.25)',
  purpleGlow: '#A855F7', mint: '#10B981',
};

// Brand palette from the 2026 onboarding redesign. New UI should read from here (or `colors`)
// rather than hardcoding hex values.
export const brand = {
  violet: '#7C2CF5',
  deep: '#4C16B8',
  magenta: '#D92CFF',
  lavender: '#F1EBFF',
  lavenderMid: '#E6DAFF',
  bg: '#FBF9FF',
  ink: '#17133B',
  inkSoft: '#6D6885',
  placeholder: '#9A94AE',
  gold: '#C98A0B',
  goldBright: '#F5B82E',
  goldSoft: '#FFF5DC',
  goldBorder: 'rgba(214, 160, 40, 0.55)',
  errorSoft: '#FDECEC',
  errorBorder: '#F5C2C2',
};

export const gradients = {
  // Primary CTA. White text stays above 4.5:1 across the centre of the fill.
  cta: ['#9440FF', '#7C2CF5', '#5F1BD8'],
  logo: ['#D92CFF', '#8F32F7', '#4C16B8'],
  progress: ['#B26BFF', '#7C2CF5'],
  canvas: ['#FFFFFF', '#F7F2FF', '#EFE6FF'],
  iconGold: ['#FFE7A6', '#F5B82E'],
};

// Three glass strengths: decorative surfaces can be airy, anything holding inputs stays near-opaque.
export const surfaces = {
  glassSoft: { backgroundColor: 'rgba(255, 255, 255, 0.55)', borderColor: 'rgba(255, 255, 255, 0.85)', borderWidth: 1 },
  glass: { backgroundColor: 'rgba(255, 255, 255, 0.74)', borderColor: 'rgba(255, 255, 255, 0.95)', borderWidth: 1 },
  glassStrong: { backgroundColor: 'rgba(255, 255, 255, 0.92)', borderColor: 'rgba(124, 44, 245, 0.10)', borderWidth: 1 },
  field: { backgroundColor: '#FAF8FF', borderColor: '#E3D9F7', borderWidth: 1.2 },
};

export const motion = { fast: 160, base: 280, slow: 420 };

export const radius = { sm: 10, md: 16, lg: 22, xl: 30, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

// One app font, Plus Jakarta Sans (loaded in App.js; AppText picks the face for each weight).
// `serif` is kept as a name so existing heading styles keep working - it is the same family.
export const fonts = {
  serif: 'PlusJakartaSans',
  sans: 'PlusJakartaSans',
};

export const shadow = {
  card: Platform.select({
    android: { elevation: 3 },
    default: { shadowColor: '#140A2E', shadowOpacity: 0.09, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  }),
  float: Platform.select({
    android: { elevation: 10 },
    default: { shadowColor: '#140A2E', shadowOpacity: 0.18, shadowRadius: 22, shadowOffset: { width: 0, height: 10 } },
  }),
  glass: Platform.select({
    android: { elevation: 4 },
    default: {
      shadowColor: '#140A2E',
      shadowOpacity: 0.07,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
  }),
  glassFloat: Platform.select({
    android: { elevation: 12 },
    default: {
      shadowColor: '#140A2E',
      shadowOpacity: 0.16,
      shadowRadius: 26,
      shadowOffset: { width: 0, height: 12 },
    },
  }),
};

// Soft neon-violet glow used on primary actions and highlights.
export const glow = Platform.select({
  android: { elevation: 8 },
  default: { shadowColor: '#A66BFF', shadowOpacity: 0.55, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
});

export const glowSubtle = Platform.select({
  android: { elevation: 4 },
  default: { shadowColor: '#A66BFF', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
});

// Comprehensive glassmorphism & liquid glass system tokens
export const glass = {
  light: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1.2,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.68)',
    borderColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1.2,
  },
  liquid: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderColor: 'rgba(215, 185, 255, 0.6)',
    borderWidth: 1.4,
  },
  subtle: {
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
    borderColor: 'rgba(255, 255, 255, 0.75)',
    borderWidth: 1,
  },
  pill: {
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1.2,
    borderRadius: radius.pill,
  },
  dark: {
    backgroundColor: 'rgba(20, 10, 46, 0.78)',
    borderColor: 'rgba(199, 125, 255, 0.35)',
    borderWidth: 1.2,
  },
  darkCard: {
    backgroundColor: 'rgba(32, 14, 76, 0.78)',
    borderColor: 'rgba(199, 125, 255, 0.38)',
    borderWidth: 1.2,
  },
  liquidDark: {
    backgroundColor: 'rgba(28, 12, 65, 0.82)',
    borderColor: 'rgba(215, 160, 255, 0.5)',
    borderWidth: 1.4,
  },
  gradients: {
    light: ['rgba(255, 255, 255, 0.88)', 'rgba(255, 255, 255, 0.62)'],
    liquid: ['rgba(255, 255, 255, 0.84)', 'rgba(244, 235, 255, 0.62)', 'rgba(235, 222, 255, 0.48)'],
    sheen: ['rgba(255, 255, 255, 0.85)', 'rgba(255, 255, 255, 0.1)'],
    liquidSheen: ['rgba(255, 255, 255, 0.95)', 'rgba(224, 195, 255, 0.4)', 'rgba(255, 255, 255, 0.05)'],
    dark: ['rgba(42, 16, 96, 0.85)', 'rgba(20, 10, 46, 0.82)'],
    liquidDark: ['rgba(46, 18, 105, 0.88)', 'rgba(24, 11, 56, 0.82)', 'rgba(15, 6, 36, 0.88)'],
    darkSheen: ['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0.02)'],
    violet: ['rgba(199, 125, 255, 0.28)', 'rgba(124, 58, 237, 0.15)'],
    goldGlass: ['rgba(201, 162, 255, 0.85)', 'rgba(166, 107, 255, 0.7)'],
  },
};

export const type = {
  display: { fontFamily: fonts.serif, fontWeight: '700', fontSize: 34, lineHeight: 40, color: colors.ink, letterSpacing: -0.8 },
  h1: { fontFamily: fonts.serif, fontWeight: '700', fontSize: 26, lineHeight: 32, color: colors.ink, letterSpacing: -0.4 },
  h2: { fontFamily: fonts.serif, fontWeight: '700', fontSize: 20, lineHeight: 26, color: colors.ink, letterSpacing: -0.2 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  body: { fontSize: 14, lineHeight: 21, color: colors.text },
  small: { fontSize: 12, lineHeight: 17, color: colors.muted },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: colors.muted, textTransform: 'uppercase' },
};
