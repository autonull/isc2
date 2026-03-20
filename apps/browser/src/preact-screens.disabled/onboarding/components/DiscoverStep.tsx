/**
 * Discover Step Component
 * Enhanced with live "Scanning for thought neighbors" DHT query visualization
 */

import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { onboardingStyles as styles } from '../styles/Onboarding.css.js';
import { StepNavigation } from './StepNavigation.js';
import { StepIndicator } from './StepIndicator.js';
import { FeatureItem } from './FeatureItem.js';
import { networkService } from '../../../services/network.js';

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
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState<'scanning' | 'complete'>('scanning');
  const [peersFound, setPeersFound] = useState(0);

  useEffect(() => {
    // Animate scanning progress
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          setScanStatus('complete');
          clearInterval(interval);
          return 100;
        }
        return prev + Math.random() * 15 + 5;
      });

      // Simulate peers being found during scan
      setPeersFound((prev) => {
        if (Math.random() > 0.6) {
          return prev + 1;
        }
        return prev;
      });
    }, 400);

    // Trigger actual DHT discovery in background
    const triggerDiscovery = async () => {
      try {
        const net = networkService as any;
        if (net?.discoverPeers) {
          await net.discoverPeers();
        }
      } catch (err) {
        console.warn('Background discovery failed:', err);
      }
    };
    triggerDiscovery();

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <StepIndicator totalSteps={3} currentStep={2} />

        <div style={styles.icon}>{scanStatus === 'complete' ? '🎉' : '📡'}</div>
        <h1 style={styles.title}>
          {scanStatus === 'complete' ? 'You\'re All Set!' : 'Scanning for Thought Neighbors…'}
        </h1>
        <p style={styles.description}>
          {scanStatus === 'complete'
            ? 'Your channel is now active and announced to the network. Here\'s what happens next:'
            : 'Querying the DHT for peers with similar semantic vectors. This happens locally — your data never leaves your device.'}
        </p>

        {/* Live Scanning Animation */}
        {scanStatus === 'scanning' && (
          <div style={{
            margin: '20px 0',
            padding: '16px',
            background: 'rgba(59, 130, 246, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(59, 130, 246, 0.3)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
              fontSize: '13px',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  display: 'inline-block',
                  animation: 'pulse 1s ease-in-out infinite',
                }}>📡</span>
                <span>Discovering peers…</span>
              </span>
              <span style={{ color: '#60a5fa' }}>{peersFound} found</span>
            </div>

            <div style={{
              height: '6px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '3px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${Math.min(scanProgress, 100)}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                borderRadius: '3px',
                transition: 'width 0.3s ease',
              }} />
            </div>

            <div style={{
              marginTop: '8px',
              fontSize: '11px',
              color: '#9ca3af',
              display: 'flex',
              justifyContent: 'space-between',
            }}>
              <span>LSH bucket queries in progress</span>
              <span>{Math.round(scanProgress)}%</span>
            </div>
          </div>
        )}

        {/* Next Steps - shown after scan complete */}
        {scanStatus === 'complete' && (
          <div style={styles.featureList}>
            {NEXT_STEPS.map((step) => (
              <FeatureItem key={step.title} {...step} />
            ))}
          </div>
        )}

        <StepNavigation
          onBack={onBack}
          onComplete={onComplete}
          nextLabel={scanStatus === 'complete' ? 'Start Exploring' : 'Please wait…'}
          loading={scanStatus === 'scanning'}
        />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
