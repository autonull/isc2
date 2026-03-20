/**
 * Onboarding Progress Hook
 */

import { useState, useCallback } from 'preact/hooks';

const ONBOARDING_COMPLETE_KEY = 'isc-onboarding-complete';

export function useOnboardingProgress() {
  const [isComplete, setIsComplete] = useState(
    localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true'
  );

  const markComplete = useCallback(() => {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    setIsComplete(true);
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
    setIsComplete(false);
  }, []);

  return {
    isComplete,
    markComplete,
    reset,
  };
}

/**
 * Check if onboarding is complete
 */
export function isOnboardingComplete(): boolean {
  return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true';
}

/**
 * Reset onboarding (for testing)
 */
export function resetOnboarding(): void {
  localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
}
