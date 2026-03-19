/**
 * Welcome Step Component
 */

import { h } from 'preact';
import { onboardingStyles as styles } from '../styles/Onboarding.css.js';
import { StepNavigation } from './StepNavigation.js';
import { FeatureItem } from './FeatureItem.js';

interface WelcomeStepProps {
  onNext: () => void;
  onSkip: () => void;
}

const FEATURES = [
  {
    icon: '🧠',
    title: 'Semantic Matching',
    description: 'AI understands meaning, not just keywords',
  },
  {
    icon: '🔒',
    title: 'Privacy First',
    description: 'No accounts, no tracking, peer-to-peer',
  },
  {
    icon: '💬',
    title: 'Real-time Chat',
    description: 'Direct WebRTC conversations with thought neighbors',
  },
];

export function WelcomeStep({ onNext, onSkip }: WelcomeStepProps) {
  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.icon}>👋</div>
        <h1 style={styles.title}>Welcome to ISC!</h1>
        <p style={styles.description}>
          Internet Semantic Chat connects you with people thinking similar
          thoughts—no accounts, no servers, no tracking.
        </p>

        <div style={styles.featureList}>
          {FEATURES.map((feature) => (
            <FeatureItem key={feature.title} {...feature} />
          ))}
        </div>

        <StepNavigation
          onNext={onNext}
          onComplete={onSkip}
          nextLabel="Get Started"
          showBack={false}
          backLabel="Skip Tour"
        />
      </div>
    </div>
  );
}
