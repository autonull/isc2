/**
 * Step Navigation Buttons Component
 */

import { h } from 'preact';
import { onboardingStyles as styles } from '../styles/Onboarding.css.js';

interface StepNavigationProps {
  onBack?: () => void;
  onNext?: () => void;
  onComplete?: () => void;
  nextLabel?: string;
  backLabel?: string;
  showBack?: boolean;
  showNext?: boolean;
  loading?: boolean;
}

export function StepNavigation({
  onBack,
  onNext,
  onComplete,
  nextLabel = 'Next',
  backLabel = 'Back',
  showBack = true,
  showNext = true,
  loading = false,
}: StepNavigationProps) {
  const handleNext = onComplete || onNext;

  return (
    <div style={{ ...styles.buttonContainer, marginTop: '16px' }}>
      {showBack && onBack && (
        <button
          style={{ ...styles.button, ...styles.secondaryBtn }}
          onClick={onBack}
          disabled={loading}
        >
          {backLabel}
        </button>
      )}
      {showNext && handleNext && (
        <button
          style={{ ...styles.button, ...styles.primaryBtn }}
          onClick={handleNext}
          disabled={loading}
        >
          {loading ? 'Loading...' : nextLabel}
        </button>
      )}
    </div>
  );
}
