/**
 * Create Channel Step Component
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { onboardingStyles as styles } from '../styles/Onboarding.css.js';
import { StepNavigation } from './StepNavigation.js';
import { StepIndicator } from './StepIndicator.js';
import { validateCreateChannelForm } from '../utils/onboardingValidator.js';
import { channelManager } from '../../../channels/manager.js';

interface CreateChannelStepProps {
  onNext: () => void;
  onBack: () => void;
  onComplete: () => void;
}

export function CreateChannelStep({
  onNext,
  onBack,
  onComplete,
}: CreateChannelStepProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    const validation = validateCreateChannelForm(name, description);
    if (!validation.valid) {
      setError(validation.error!);
      return;
    }

    setSaving(true);
    setError('');

    try {
      await channelManager.createChannel(name.trim(), description.trim(), 0.15, []);
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
        <StepIndicator totalSteps={3} currentStep={1} />

        <div style={styles.icon}>📝</div>
        <h1 style={styles.title}>Create Your First Channel</h1>
        <p style={styles.description}>
          A channel represents a thought or topic you want to explore. This is
          how you'll find like-minded peers.
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

        <StepNavigation
          onBack={onBack}
          onNext={handleCreate}
          nextLabel={saving ? 'Creating...' : 'Create & Continue'}
          loading={saving}
        />
      </div>
    </div>
  );
}
