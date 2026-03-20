/**
 * Welcome Step Component
 * Enhanced with hero copy from the plan
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
        <h1 style={styles.title}>Welcome to ISC</h1>
        
        {/* Hero Copy */}
        <div style={{
          margin: '20px 0',
          padding: '16px',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1))',
          borderRadius: '12px',
          border: '1px solid rgba(59, 130, 246, 0.2)',
        }}>
          <p style={{
            fontSize: '15px',
            lineHeight: '1.6',
            color: '#e5e7eb',
            margin: 0,
          }}>
            <strong style={{ color: '#60a5fa' }}>Open a Tab.</strong>{' '}
            Type what you're thinking about.{' '}
            <strong style={{ color: '#60a5fa' }}>Meet people closest to your thought.</strong>
          </p>
          <p style={{
            fontSize: '13px',
            color: '#9ca3af',
            marginTop: '8px',
            marginBottom: 0,
          }}>
            No account. No download. No algorithm.
          </p>
        </div>

        <p style={styles.description}>
          ISC connects you with people thinking similar thoughts using local AI
          embeddings. Your data never leaves your device — pure peer-to-peer.
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
