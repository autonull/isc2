/**
 * Step Indicator Component
 */

import { h } from 'preact';
import { onboardingStyles as styles } from '../styles/Onboarding.css.js';

interface StepIndicatorProps {
  totalSteps: number;
  currentStep: number;
}

export function StepIndicator({ totalSteps, currentStep }: StepIndicatorProps) {
  return (
    <div style={styles.progress}>
      {Array.from({ length: totalSteps }).map((_, index) => (
        <div
          key={index}
          style={{
            ...styles.progressDot,
            ...(index <= currentStep ? styles.progressDotActive : {}),
          }}
        />
      ))}
    </div>
  );
}
