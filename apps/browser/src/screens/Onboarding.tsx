/**
 * Onboarding Flow - First-time user experience
 * 3-step onboarding: Create channel → Discover → Chat
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { channelManager } from '../channels/manager.js';
import { navigate } from '../router.js';

const ONBOARDING_COMPLETE_KEY = 'isc-onboarding-complete';

const styles = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  modal: {
    background: 'white',
    borderRadius: '16px',
    padding: '32px',
    maxWidth: '500px',
    width: '90%',
    maxHeight: '90vh',
    overflowY: 'auto' as const,
  },
  progress: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
  },
  progressDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#e1e8ed',
    transition: 'background 0.3s',
  },
  progressDotActive: {
    background: '#1da1f2',
  },
  icon: {
    fontSize: '64px',
    textAlign: 'center' as const,
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold' as const,
    marginBottom: '12px',
    textAlign: 'center' as const,
  },
  description: {
    fontSize: '16px',
    color: '#657786',
    marginBottom: '24px',
    textAlign: 'center' as const,
    lineHeight: 1.5,
  },
  featureList: {
    marginBottom: '24px',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '16px',
    fontSize: '14px',
  },
  featureIcon: {
    fontSize: '20px',
  },
  buttonContainer: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
  button: {
    padding: '12px 32px',
    borderRadius: '24px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold' as const,
    transition: 'transform 0.2s',
  },
  primaryBtn: {
    background: '#1da1f2',
    color: 'white',
  },
  secondaryBtn: {
    background: '#f7f9fa',
    color: '#657786',
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #e1e8ed',
    borderRadius: '8px',
    fontSize: '16px',
    marginBottom: '16px',
    boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%',
    padding: '12px',
    border: '1px solid #e1e8ed',
    borderRadius: '8px',
    fontSize: '16px',
    minHeight: '100px',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  },
  error: {
    color: '#e0245e',
    fontSize: '14px',
    marginTop: '8px',
    textAlign: 'center' as const,
  },
};

interface OnboardingProps {
  onComplete?: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    onComplete?.();
  };

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    navigate('now');
    onComplete?.();
  };

  if (step === 0) {
    return (
      <WelcomeStep
        onNext={() => setStep(1)}
        onSkip={handleSkip}
      />
    );
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

interface WelcomeStepProps {
  onNext: () => void;
  onSkip: () => void;
}

function WelcomeStep({ onNext, onSkip }: WelcomeStepProps) {
  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.icon}>👋</div>
        <h1 style={styles.title}>Welcome to ISC!</h1>
        <p style={styles.description}>
          Internet Semantic Chat connects you with people thinking similar thoughts—no accounts, no servers, no tracking.
        </p>

        <div style={styles.featureList}>
          <div style={styles.featureItem}>
            <span style={styles.featureIcon}>🧠</span>
            <div>
              <strong>Semantic Matching</strong>
              <p style={{ margin: '4px 0 0', color: '#657786' }}>
                AI understands meaning, not just keywords
              </p>
            </div>
          </div>
          <div style={styles.featureItem}>
            <span style={styles.featureIcon}>🔒</span>
            <div>
              <strong>Privacy First</strong>
              <p style={{ margin: '4px 0 0', color: '#657786' }}>
                No accounts, no tracking, peer-to-peer
              </p>
            </div>
          </div>
          <div style={styles.featureItem}>
            <span style={styles.featureIcon}>💬</span>
            <div>
              <strong>Real-time Chat</strong>
              <p style={{ margin: '4px 0 0', color: '#657786' }}>
                Direct WebRTC conversations with thought neighbors
              </p>
            </div>
          </div>
        </div>

        <div style={styles.buttonContainer}>
          <button
            style={{ ...styles.button, ...styles.secondaryBtn }}
            onClick={onSkip}
          >
            Skip Tour
          </button>
          <button
            style={{ ...styles.button, ...styles.primaryBtn }}
            onClick={onNext}
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}

interface CreateChannelStepProps {
  onNext: () => void;
  onBack: () => void;
  onComplete: () => void;
}

function CreateChannelStep({ onNext, onBack, onComplete }: CreateChannelStepProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Channel name is required');
      return;
    }
    if (!description.trim()) {
      setError('Description is required');
      return;
    }
    if (description.trim().length < 10) {
      setError('Description must be at least 10 characters');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const channel = await channelManager.createChannel(
        name.trim(),
        description.trim(),
        0.15,
        []
      );

      console.log('[Onboarding] Channel created:', channel.id);
      onComplete();
    } catch (err) {
      setError('Failed to create channel: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.progress}>
          <div style={{ ...styles.progressDot, ...styles.progressDotActive }} />
          <div style={{ ...styles.progressDot, ...styles.progressDotActive }} />
          <div style={styles.progressDot} />
        </div>

        <div style={styles.icon}>📝</div>
        <h1 style={styles.title}>Create Your First Channel</h1>
        <p style={styles.description}>
          A channel represents a thought or topic you want to explore. This is how you'll find like-minded peers.
        </p>

        <input
          type="text"
          value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
          placeholder="Channel Name (e.g., 'AI Ethics')"
          style={styles.input}
          maxLength={50}
        />

        <textarea
          value={description}
          onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
          placeholder="Describe your thoughts in detail... (min 10 characters)"
          style={styles.textarea}
          maxLength={500}
        />

        {error && <div style={styles.error}>{error}</div>}

        <div style={{ ...styles.buttonContainer, marginTop: '16px' }}>
          <button
            style={{ ...styles.button, ...styles.secondaryBtn }}
            onClick={onBack}
          >
            Back
          </button>
          <button
            style={{ ...styles.button, ...styles.primaryBtn }}
            onClick={handleCreate}
            disabled={saving}
          >
            {saving ? 'Creating...' : 'Create & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface DiscoverStepProps {
  onComplete: () => void;
  onBack: () => void;
}

function DiscoverStep({ onComplete, onBack }: DiscoverStepProps) {
  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.progress}>
          <div style={{ ...styles.progressDot, ...styles.progressDotActive }} />
          <div style={{ ...styles.progressDot, ...styles.progressDotActive }} />
          <div style={{ ...styles.progressDot, ...styles.progressDotActive }} />
        </div>

        <div style={styles.icon}>🎉</div>
        <h1 style={styles.title}>You're All Set!</h1>
        <p style={styles.description}>
          Your channel is now active and announced to the network. Here's what happens next:
        </p>

        <div style={styles.featureList}>
          <div style={styles.featureItem}>
            <span style={styles.featureIcon}>📡</span>
            <div>
              <strong>Discover Tab</strong>
              <p style={{ margin: '4px 0 0', color: '#657786' }}>
                Find peers with semantically similar thoughts. Matches are grouped by similarity.
              </p>
            </div>
          </div>
          <div style={styles.featureItem}>
            <span style={styles.featureIcon}>💬</span>
            <div>
              <strong>Start Chatting</strong>
              <p style={{ margin: '4px 0 0', color: '#657786' }}>
                Click "Start Chat" on a match to begin a peer-to-peer conversation.
              </p>
            </div>
          </div>
          <div style={styles.featureItem}>
            <span style={styles.featureIcon}>🔔</span>
            <div>
              <strong>Get Notified</strong>
              <p style={{ margin: '4px 0 0', color: '#657786' }}>
                Enable notifications in Settings to get alerts for new messages.
              </p>
            </div>
          </div>
        </div>

        <div style={{ ...styles.buttonContainer, marginTop: '16px' }}>
          <button
            style={{ ...styles.button, ...styles.secondaryBtn }}
            onClick={onBack}
          >
            Back
          </button>
          <button
            style={{ ...styles.button, ...styles.primaryBtn }}
            onClick={onComplete}
          >
            Start Exploring
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Check if onboarding is complete
 */
export function isOnboardingComplete(): boolean {
  return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true';
}

/**
 * Reset onboarding (for testing)
 */
export function resetOnboarding(): void {
  localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
}
