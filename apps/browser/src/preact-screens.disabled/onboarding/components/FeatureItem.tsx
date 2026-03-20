/**
 * Feature List Item Component
 */

import { h } from 'preact';
import { onboardingStyles as styles } from '../styles/Onboarding.css.js';

interface FeatureItemProps {
  icon: string;
  title: string;
  description: string;
}

export function FeatureItem({ icon, title, description }: FeatureItemProps) {
  return (
    <div style={styles.featureItem}>
      <span style={styles.featureIcon}>{icon}</span>
      <div>
        <strong>{title}</strong>
        <p style={{ margin: '4px 0 0', color: '#657786' }}>{description}</p>
      </div>
    </div>
  );
}
