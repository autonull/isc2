/**
 * Onboarding Flow - First-time user experience
 * 3-step onboarding: Create channel → Discover → Chat
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { WelcomeStep } from './components/WelcomeStep.js';
import { CreateChannelStep } from './components/CreateChannelStep.js';
import { DiscoverStep } from './components/DiscoverStep.js';
import { useOnboardingProgress } from './hooks/useOnboardingProgress.js';

interface OnboardingProps {
  onComplete?: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const { markComplete } = useOnboardingProgress();

  const handleComplete = () => {
    markComplete();
    onComplete?.();
  };

  const handleSkip = () => {
    markComplete();
    navigateToDiscover();
    onComplete?.();
  };

  if (step === 0) {
    return <WelcomeStep onNext={() => setStep(1)} onSkip={handleSkip} />;
  }

  if (step === 1) {
    return (
      <CreateChannelStep
        onNext={() => setStep(2)}
        onBack={() => setStep(0)}
        onComplete={handleComplete}
      />
    );
  }

  return (
    <DiscoverStep
      onComplete={handleComplete}
      onBack={() => setStep(1)}
    />
  );
}

// Re-export utility functions
export { isOnboardingComplete, resetOnboarding } from './hooks/useOnboardingProgress.js';

// Navigate to discover screen
async function navigateToDiscover() {
  const { navigate } = await import('../../router.js');
  navigate('discover');
}
