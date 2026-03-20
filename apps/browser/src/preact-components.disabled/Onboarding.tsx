/**
 * Onboarding Flow - First Time User Experience
 *
 * Guides new users through:
 * 1. Welcome & explanation
 * 2. Create identity (name + bio)
 * 3. Create first channel
 */

import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { useDependencies } from '../di/container.js';

const styles = {
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 } as const,
  container: { background: 'white', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' } as const,
  header: { textAlign: 'center' as const, marginBottom: '30px' } as const,
  icon: { fontSize: '64px', marginBottom: '16px' } as const,
  title: { fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#14171a' } as const,
  subtitle: { fontSize: '14px', color: '#657786', margin: 0 } as const,
  step: { marginBottom: '24px' } as const,
  label: { display: 'block', fontSize: '14px', fontWeight: 'bold' as const, color: '#14171a', marginBottom: '8px' } as const,
  input: { width: '100%', padding: '12px 16px', border: '1px solid #e1e8ed', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const, outline: 'none' } as const,
  textarea: { width: '100%', padding: '12px 16px', border: '1px solid #e1e8ed', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const, outline: 'none', minHeight: '80px', resize: 'vertical' as const } as const,
  button: { width: '100%', padding: '14px 24px', background: '#1da1f2', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold' as const, cursor: 'pointer', marginTop: '16px' } as const,
  buttonDisabled: { opacity: 0.5, cursor: 'not-allowed' } as const,
  secondaryButton: { background: 'transparent', border: '1px solid #e1e8ed', color: '#657786', marginTop: '12px' } as const,
  progress: { display: 'flex', gap: '8px', marginBottom: '24px' } as const,
  progressDot: { width: '8px', height: '8px', borderRadius: '50%', background: '#e1e8ed', flex: '0 0 8px' } as const,
  progressDotActive: { background: '#1da1f2' } as const,
  featureList: { listStyle: 'none', padding: 0, margin: '20px 0' } as const,
  featureItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid #f5f8fa', fontSize: '14px', color: '#657786' } as const,
  featureIcon: { fontSize: '20px' } as const,
  error: { color: '#e0245e', fontSize: '13px', marginTop: '8px' } as const,
  loading: { textAlign: 'center' as const, padding: '20px', color: '#657786' } as const,
};

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const { networkService } = useDependencies();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [channelName, setChannelName] = useState('');
  const [channelDesc, setChannelDesc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check if user has completed onboarding before
  useEffect(() => {
    const completed = localStorage.getItem('isc-onboarding-completed');
    if (completed) {
      onComplete();
    }
  }, [onComplete]);

  const handleNext = async () => {
    setError(null);

    if (step === 0) {
      // Validate name
      if (!name.trim()) {
        setError('Please enter your name');
        return;
      }
      setStep(1);
    } else if (step === 1) {
      // Validate bio
      if (!bio.trim()) {
        setError('Please enter a short bio');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      // Validate channel
      if (!channelName.trim()) {
        setError('Please enter a channel name');
        return;
      }
      if (!channelDesc.trim()) {
        setError('Please enter a channel description');
        return;
      }
      setLoading(true);

      try {
        // Update identity
        if (networkService) {
          await networkService.updateIdentity({ name: name.trim(), bio: bio.trim() });

          // Create first channel
          await networkService.createChannel(channelName.trim(), channelDesc.trim());

          // Discover peers
          await networkService.discoverPeers();
        }

        // Mark onboarding as completed
        localStorage.setItem('isc-onboarding-completed', 'true');
        setLoading(false);
        onComplete();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to complete setup');
        setLoading(false);
      }
    }
  };

  const handleSkip = () => {
    localStorage.setItem('isc-onboarding-completed', 'true');
    onComplete();
  };

  const totalSteps = 3;

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        {/* Progress indicator */}
        <div style={styles.progress}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              style={{
                ...styles.progressDot,
                ...(i <= step ? styles.progressDotActive : {}),
              }}
            />
          ))}
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div data-testid="onboarding-step-1">
            <div style={styles.header}>
              <div style={styles.icon}>👋</div>
              <h1 style={styles.title}>Welcome to ISC</h1>
              <p style={styles.subtitle}>Internet Semantic Chat — like IRC but for the LM era</p>
            </div>

            <ul style={styles.featureList}>
              <li style={styles.featureItem}>
                <span style={styles.featureIcon}>🧠</span>
                <span>AI-powered semantic matching finds peers with similar interests</span>
              </li>
              <li style={styles.featureItem}>
                <span style={styles.featureIcon}>🔐</span>
                <span>End-to-end encrypted, peer-to-peer messaging</span>
              </li>
              <li style={styles.featureItem}>
                <span style={styles.featureIcon}>📡</span>
                <span>No central server — you own your data</span>
              </li>
              <li style={styles.featureItem}>
                <span style={styles.featureIcon}>📹</span>
                <span>Direct video calls with discovered peers</span>
              </li>
            </ul>

            <div style={styles.step}>
              <label style={styles.label}>What should we call you?</label>
              <input
                type="text"
                value={name}
                data-testid="onboarding-name-input"
                onInput={(e) => setName((e.target as HTMLInputElement).value)}
                placeholder="Your name"
                style={styles.input}
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {error && <div style={styles.error}>{error}</div>}
            </div>

            <button
              onClick={handleNext}
              data-testid="onboarding-next"
              style={{ ...styles.button, ...(name.trim() ? {} : styles.buttonDisabled) }}
              disabled={!name.trim()}
            >
              Continue
            </button>
            <button onClick={handleSkip} style={{ ...styles.button, ...styles.secondaryButton }}>
              Skip for now
            </button>
          </div>
        )}

        {/* Step 1: Bio */}
        {step === 1 && (
          <div data-testid="onboarding-step-2">
            <div style={styles.header}>
              <div style={styles.icon}>📝</div>
              <h1 style={styles.title}>Tell us about yourself</h1>
              <p style={styles.subtitle}>This helps us find peers with similar interests</p>
            </div>

            <div style={styles.step}>
              <label style={styles.label}>Short bio</label>
              <textarea
                value={bio}
                data-testid="onboarding-bio-input"
                onInput={(e) => setBio((e.target as HTMLTextAreaElement).value)}
                placeholder="I'm interested in AI, distributed systems, and..."
                style={styles.textarea}
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <p style={{ fontSize: '12px', color: '#657786', marginTop: '8px' }}>
                AI will analyze this to find semantic matches with other users.
              </p>
              {error && <div style={styles.error}>{error}</div>}
            </div>

            <button onClick={handleNext} data-testid="onboarding-next" style={styles.button}>Continue</button>
            <button onClick={handleSkip} style={{ ...styles.button, ...styles.secondaryButton }}>Skip</button>
          </div>
        )}

        {/* Step 2: First Channel */}
        {step === 2 && (
          <div data-testid="onboarding-step-3">
            <div style={styles.header}>
              <div style={styles.icon}>📢</div>
              <h1 style={styles.title}>Create your first channel</h1>
              <p style={styles.subtitle}>Channels are topics you want to discuss</p>
            </div>

            <div style={styles.step}>
              <label style={styles.label}>Channel name</label>
              <input
                type="text"
                value={channelName}
                data-testid="onboarding-channel-name-input"
                onInput={(e) => setChannelName((e.target as HTMLInputElement).value)}
                placeholder="e.g., AI Ethics, Machine Learning, Web3"
                style={styles.input}
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>

            <div style={styles.step}>
              <label style={styles.label}>Description</label>
              <textarea
                value={channelDesc}
                data-testid="onboarding-channel-desc-input"
                onInput={(e) => setChannelDesc((e.target as HTMLTextAreaElement).value)}
                placeholder="What's this channel about?"
                style={styles.textarea}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {error && <div style={styles.error}>{error}</div>}
            </div>

            <button
              onClick={handleNext}
              data-testid="onboarding-next"
              disabled={loading}
              style={{ ...styles.button, ...(loading ? styles.buttonDisabled : {}) }}
            >
              {loading ? 'Setting up...' : 'Complete Setup'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
