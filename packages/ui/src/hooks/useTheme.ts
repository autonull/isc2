/**
 * useTheme Hook
 *
 * Theme management with system preference detection.
 */

import { useEffect, useCallback } from 'preact/hooks';
import type { AppState } from '@isc/state';
import { useAppState, getStateStore } from './useAppState.js';
import { resolveTheme, type Theme } from '../styles/index.js';

/**
 * Use theme hook
 */
export function useTheme(): {
  theme: Theme;
  preference: 'light' | 'dark' | 'system';
  setPreference: (preference: 'light' | 'dark' | 'system') => void;
} {
  const preference = useAppState((state: AppState) => state.settings.theme);
  const theme = resolveTheme(preference);

  const setPreference = useCallback((newPreference: 'light' | 'dark' | 'system') => {
    const store = getStateStore();
    if (store) {
      store.setState({
        settings: { ...store.getState().settings, theme: newPreference },
      });
    }
  }, []);

  // Update CSS custom properties
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const colors = theme.colors;

    root.style.setProperty('--bg-primary', colors.background);
    root.style.setProperty('--bg-secondary', colors.backgroundSecondary);
    root.style.setProperty('--bg-tertiary', colors.backgroundTertiary);
    root.style.setProperty('--text-primary', colors.text);
    root.style.setProperty('--text-secondary', colors.textSecondary);
    root.style.setProperty('--text-muted', colors.textMuted);
    root.style.setProperty('--border-primary', colors.border);
    root.style.setProperty('--border-light', colors.borderLight);
    root.style.setProperty('--color-primary', colors.primary);
    root.style.setProperty('--color-primary-hover', colors.primaryHover);
    root.style.setProperty('--color-primary-active', colors.primaryActive);
    root.style.setProperty('--color-success', colors.success);
    root.style.setProperty('--color-warning', colors.warning);
    root.style.setProperty('--color-error', colors.error);
    root.style.setProperty('--color-info', colors.info);
  }, [theme]);

  return { theme, preference, setPreference };
}

/**
 * Use dark mode hook
 */
export function useDarkMode(): {
  isDark: boolean;
  toggle: () => void;
} {
  const { theme, preference, setPreference } = useTheme();

  const toggle = useCallback(() => {
    setPreference(preference === 'dark' ? 'light' : 'dark');
  }, [preference, setPreference]);

  return {
    isDark: theme.isDark,
    toggle,
  };
}
