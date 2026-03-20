/**
 * Onboarding Module
 */

export { Onboarding, isOnboardingComplete, resetOnboarding } from './Onboarding.js';
export { useOnboardingState } from './hooks/useOnboardingState.js';
export { useOnboardingProgress } from './hooks/useOnboardingProgress.js';
export { StepIndicator } from './components/StepIndicator.js';
export { StepNavigation } from './components/StepNavigation.js';
export { FeatureItem } from './components/FeatureItem.js';
export { WelcomeStep } from './components/WelcomeStep.js';
export { CreateChannelStep } from './components/CreateChannelStep.js';
export { DiscoverStep } from './components/DiscoverStep.js';
export {
  validateChannelName,
  validateDescription,
  validateCreateChannelForm,
} from './utils/onboardingValidator.js';
export { onboardingStyles } from './styles/Onboarding.css.js';
