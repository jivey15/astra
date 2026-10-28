/**
 * Electric Cyan & Deep Cosmic Blue Theme for Astra (project-loring)
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#FFFFFF',
    background: '#050B18',
    backgroundElement: '#0A1528',
    backgroundSelected: '#0E1E38',
    textSecondary: '#93C5FD',
  },
} as const;

export const AstraColors = {
  cosmicNavyDeep: '#050B18',
  cosmicNavyMid: '#0A1528',
  hudGlass: 'rgba(14, 30, 56, 0.78)',
  hudGlassStrong: 'rgba(10, 21, 40, 0.92)',
  borderDefault: '#1D4ED8',
  borderActive: '#38BDF8',
  electricCyan: '#0EA5E9',
  glowingCyan: '#38BDF8',
  iceBlue: '#7DD3FC',
  mutedIceBlue: '#93C5FD',
  starWhite: '#FFFFFF',
  cyanGlowShadow: 'rgba(56, 189, 248, 0.35)',
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
