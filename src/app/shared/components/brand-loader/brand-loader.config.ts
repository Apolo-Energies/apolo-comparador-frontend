export type LoaderBrand = 'apolo' | 'renova' | 'coexpal';

export interface LoaderTheme {
  logoSrc: string;
  wordmark: string;
  ringColor: string;
  accentColor: string;
  glowColor: string;
  backdrop: string;
  iconPath: string;
}

export const LOADER_ICONS = {
  zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  leaf: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2.96a1 1 0 0 1 1.8.52c.4 3.42.6 5.82-2.02 8.26A7 7 0 0 1 14 14a6 6 0 0 0-3 6z',
  flame: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
} as const;

export const BRAND_THEMES: Record<LoaderBrand, LoaderTheme> = {
  apolo: {
    logoSrc: '/apolo/isotipo_blanco.svg',
    wordmark: 'Apolo Energies',
    ringColor: '#12aff0',
    accentColor: '#7dd3fc',
    glowColor: 'rgba(56, 189, 248, 0.55)',
    backdrop: 'rgba(7, 11, 20, 0.82)',
    iconPath: LOADER_ICONS.zap,
  },
  renova: {
    logoSrc: '/renova/logo.webp',
    wordmark: 'Renova',
    ringColor: '#1fbf75',
    accentColor: '#86efac',
    glowColor: 'rgba(52, 211, 153, 0.55)',
    backdrop: 'rgba(7, 11, 20, 0.82)',
    iconPath: LOADER_ICONS.zap,
  },
  coexpal: {
    logoSrc: '/coexpal/logo-1.webp',
    wordmark: 'Coexpal',
    ringColor: '#e84e1b',
    accentColor: '#fdba74',
    glowColor: 'rgba(251, 146, 60, 0.55)',
    backdrop: 'rgba(7, 11, 20, 0.82)',
    iconPath: LOADER_ICONS.zap,
  },
};

export const DEFAULT_BRAND: LoaderBrand = 'apolo';
