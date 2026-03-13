/**
 * Theme Provider
 *
 * Provides theme context to component tree.
 */

import { h, JSX } from 'preact';
import { createContext } from 'preact';
import { useTheme as useThemeHook } from '../hooks/useTheme.js';
import type { Theme } from '../styles/index.js';

/**
 * Theme context
 */
export const ThemeContext = createContext<{
  theme: Theme;
  preference: 'light' | 'dark' | 'system';
  setPreference: (preference: 'light' | 'dark' | 'system') => void;
} | null>(null);

/**
 * Theme provider props
 */
export interface ThemeProviderProps {
  children: JSX.Element;
}

/**
 * Theme provider component
 */
export function ThemeProvider({ children }: ThemeProviderProps): JSX.Element {
  const themeState = useThemeHook();

  return h(ThemeContext.Provider, { value: themeState }, children);
}

/**
 * Use theme from context
 */
export function useThemeContext(): ReturnType<typeof useThemeHook> {
  // In Preact, we'd use useContext here, but for now return hook result
  return useThemeHook();
}
