/* eslint-disable */
/**
 * Theme Definitions
 *
 * Light, dark, and high-contrast themes.
 */

import { colors } from './tokens.js';

/**
 * Theme color scheme
 */
export interface ThemeColors {
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderLight: string;
  primary: string;
  primaryHover: string;
  primaryActive: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

/**
 * Theme definition
 */
export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
  isDark: boolean;
}

/**
 * Light theme
 */
export const lightTheme: Theme = {
  id: 'light',
  name: 'Light',
  isDark: false,
  colors: {
    background: colors.neutral[0],
    backgroundSecondary: colors.neutral[50],
    backgroundTertiary: colors.neutral[100],
    text: colors.neutral[900],
    textSecondary: colors.neutral[700],
    textMuted: colors.neutral[500],
    border: colors.neutral[200],
    borderLight: colors.neutral[100],
    primary: colors.primary[600],
    primaryHover: colors.primary[700],
    primaryActive: colors.primary[800],
    success: colors.semantic.success,
    warning: colors.semantic.warning,
    error: colors.semantic.error,
    info: colors.semantic.info,
  },
};

/**
 * Dark theme
 */
export const darkTheme: Theme = {
  id: 'dark',
  name: 'Dark',
  isDark: true,
  colors: {
    background: colors.neutral[900],
    backgroundSecondary: colors.neutral[800],
    backgroundTertiary: colors.neutral[700],
    text: colors.neutral[50],
    textSecondary: colors.neutral[200],
    textMuted: colors.neutral[400],
    border: colors.neutral[700],
    borderLight: colors.neutral[800],
    primary: colors.primary[400],
    primaryHover: colors.primary[300],
    primaryActive: colors.primary[200],
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#f87171',
    info: '#60a5fa',
  },
};

/**
 * High contrast theme
 */
export const highContrastTheme: Theme = {
  id: 'high-contrast',
  name: 'High Contrast',
  isDark: true,
  colors: {
    background: '#000000',
    backgroundSecondary: '#1a1a1a',
    backgroundTertiary: '#2d2d2d',
    text: '#ffffff',
    textSecondary: '#e5e5e5',
    textMuted: '#a3a3a3',
    border: '#ffffff',
    borderLight: '#737373',
    primary: '#ffff00',
    primaryHover: '#ffff66',
    primaryActive: '#ffff99',
    success: '#00ff00',
    warning: '#ffff00',
    error: '#ff0000',
    info: '#00ffff',
  },
};

/**
 * All themes
 */
export const themes: Record<string, Theme> = {
  light: lightTheme,
  dark: darkTheme,
  'high-contrast': highContrastTheme,
};

/**
 * Get theme by ID
 */
export function getTheme(id: string): Theme | undefined {
  return themes[id];
}

/**
 * Resolve theme based on user preference
 */
export function resolveTheme(preference: 'light' | 'dark' | 'system'): Theme {
  if (preference === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? darkTheme
        : lightTheme;
    }
    return lightTheme;
  }
  return themes[preference];
}
