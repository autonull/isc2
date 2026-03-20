/**
 * Onboarding State Hook
 */

import { useState } from 'preact/hooks';

export interface OnboardingState {
  currentStep: number;
  isComplete: boolean;
}

export function useOnboardingState(initialStep: number = 0) {
  const [currentStep, setCurrentStep] = useState(initialStep);

  const nextStep = () => {
    setCurrentStep((prev) => prev + 1);
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  const goToStep = (step: number) => {
    setCurrentStep(step);
  };

  const reset = () => {
    setCurrentStep(0);
  };

  return {
    currentStep,
    nextStep,
    prevStep,
    goToStep,
    reset,
  };
}
