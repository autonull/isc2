/**
 * Discover Step Component
 */

import { h } from 'preact';
import { onboardingStyles as styles } from '../styles/Onboarding.css.js';
import { StepNavigation } from './StepNavigation.js';
import { StepIndicator } from './StepIndicator.js';
import { FeatureItem } from './FeatureItem.js';

interface DiscoverStepProps {
  onComplete: () => void;
  onBack: () => void;
}

const NEXT_STEPS = [
  {
    icon: '📡',
    title: 'Discover Tab',
    description:
      'Find peers with semantically similar thoughts. Matches are grouped by similarity.',
  },
  {
    icon: '💬',
    title: 'Start Chatting',
    description:
      'Click "Start Chat" on a match to begin a peer-to-peer conversation.',
  },
  {
    icon: '🔔',
    title: 'Get Notified',
    description:
      'Enable notifications in Settings to get alerts for new messages.',
  },
];

export function DiscoverStep({ onComplete, onBack }: DiscoverStepProps) {
  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <StepIndicator totalSteps={3} currentStep={2} />

        <div style={styles.icon}>🎉</div>
        <h1 style={styles.title}>You're All Set!</h1>
        <p style={styles.description}>
          Your channel is now active and announced to the network. Here's what
          happens next:
        </p>

        <div style={styles.featureList}>
          {NEXT_STEPS.map((step) => (
            <FeatureItem key={step.title} {...step} />
          ))}
        </div>

        <StepNavigation
          onBack={onBack}
          onComplete={onComplete}
          nextLabel="Start Exploring"
        />
      </div>
    </div>
  );
}
