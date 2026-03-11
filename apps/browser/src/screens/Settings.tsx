import { h } from 'preact';
import { useState } from 'preact/hooks';

interface SettingsProps {
  identity: {
    fingerprint: string;
  };
  delegation: {
    allowEmbed: boolean;
    allowANN: boolean;
    delegateOnlyChannels: boolean;
  };
  onUpdateDelegation: (settings: Partial<SettingsProps['delegation']>) => void;
  onExportIdentity: () => void;
  onResetIdentity: () => void;
}

export function SettingsScreen({
  identity,
  delegation,
  onUpdateDelegation,
  onExportIdentity,
  onResetIdentity,
}: SettingsProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const Section = ({
    id,
    title,
    children,
  }: {
    id: string;
    title: string;
    children: preact.ComponentChildren;
  }) => (
    <div class={`settings-section ${activeSection === id ? 'expanded' : ''}`}>
      <button
        class="section-header"
        onClick={() => setActiveSection(activeSection === id ? null : id)}
      >
        <span>{title}</span>
        <span class="chevron">{activeSection === id ? '▼' : '▶'}</span>
      </button>
      {activeSection === id && <div class="section-content">{children}</div>}
    </div>
  );

  return (
    <div class="screen settings-screen">
      <header class="screen-header">
        <h1>Settings</h1>
      </header>

      <Section id="identity" title="Identity">
        <div class="setting-item">
          <label>Fingerprint</label>
          <code class="fingerprint">{identity.fingerprint}</code>
        </div>
        <div class="setting-actions">
          <button class="secondary-btn" onClick={onExportIdentity}>
            Export Key
          </button>
          <button class="danger-btn" onClick={onResetIdentity}>
            Reset Identity
          </button>
        </div>
      </Section>

      <Section id="delegation" title="Delegation">
        <div class="setting-item">
          <label>
            <input
              type="checkbox"
              checked={delegation.allowEmbed}
              onChange={(e) =>
                onUpdateDelegation({ allowEmbed: (e.target as HTMLInputElement).checked })
              }
            />
            Allow embedding delegation
          </label>
          <p class="hint">Delegate embedding to supernodes</p>
        </div>
        <div class="setting-item">
          <label>
            <input
              type="checkbox"
              checked={delegation.allowANN}
              onChange={(e) =>
                onUpdateDelegation({ allowANN: (e.target as HTMLInputElement).checked })
              }
            />
            Allow ANN queries
          </label>
          <p class="hint">Delegate similarity searches</p>
        </div>
        <div class="setting-item">
          <label>
            <input
              type="checkbox"
              checked={delegation.delegateOnlyChannels}
              onChange={(e) =>
                onUpdateDelegation({ delegateOnlyChannels: (e.target as HTMLInputElement).checked })
              }
            />
            Delegate only selected channels
          </label>
          <p class="hint">Only delegate for specific channels</p>
        </div>
      </Section>

      <Section id="network" title="Network">
        <div class="setting-item">
          <label>Status</label>
          <span class="status online">Connected</span>
        </div>
        <div class="setting-item">
          <label>Peers</label>
          <span>0 active</span>
        </div>
      </Section>

      <Section id="about" title="About">
        <div class="setting-item">
          <label>Version</label>
          <span>0.1.0</span>
        </div>
        <div class="setting-item">
          <label>Protocol</label>
          <span>/isc/chat/1.0</span>
        </div>
      </Section>
    </div>
  );
}
