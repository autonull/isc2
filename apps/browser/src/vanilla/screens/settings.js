/**
 * Settings Screen — Identity, discovery, preferences, danger zone
 */

import {
  identityService,
  settingsService,
  channelService,
  moderationService,
} from '../../services/index.js';
import { networkService } from '../../services/network.ts';
import { escapeHtml } from '../utils/dom.js';
import { toast as toasts } from '../../utils/toast.ts';
import { modals } from '../components/modal.js';
import { showEditModal } from '../components/mixerPanel.js';
import { getBridgeMomentCandidates, getTopSimilarPeers } from '../../services/peerProximity.ts';

export function render() {
  const identity = identityService.getIdentity();
  const settings = settingsService.get();
  const channels = channelService.getAll();
  const netStatus = networkService.getStatus();
  const connected = netStatus?.connected ?? false;
  const activeTab = localStorage.getItem('isc:settings-tab') || 'profile';

  return `
    <div class="screen settings-screen" data-testid="settings-screen">
      <div class="screen-header" data-testid="settings-header">
        <h1 class="screen-title" data-testid="settings-title">⚙️ Settings</h1>
        <span class="status-badge ${connected ? 'online' : 'offline'}" data-testid="settings-status">
          ${connected ? '● Online' : '○ Offline'}
        </span>
      </div>

      <div class="settings-tabs" data-testid="settings-tabs">
        <button class="settings-tab${activeTab === 'profile' ? ' active' : ''}" data-tab="profile" data-testid="settings-tab-profile">Profile</button>
        <button class="settings-tab${activeTab === 'network' ? ' active' : ''}" data-tab="network" data-testid="settings-tab-network">Network</button>
        <button class="settings-tab${activeTab === 'appearance' ? ' active' : ''}" data-tab="appearance" data-testid="settings-tab-appearance">Appearance</button>
        <button class="settings-tab${activeTab === 'channels' ? ' active' : ''}" data-tab="channels" data-testid="settings-tab-channels">Channels</button>
        <button class="settings-tab${activeTab === 'privacy' ? ' active' : ''}" data-tab="privacy" data-testid="settings-tab-privacy">Privacy</button>
      </div>

      <div class="screen-body" data-testid="settings-content">
        ${renderProfile(identity, activeTab === 'profile')}
        ${renderIdentity(identity, activeTab === 'profile')}
        ${renderThoughtConnections(activeTab === 'profile')}
        ${renderDiscovery(settings, activeTab === 'network')}
        ${renderAdvanced(activeTab === 'network')}
        ${renderAppearance(settings, activeTab === 'appearance')}
        ${renderShare(activeTab === 'appearance')}
        ${renderChannels(channels, activeTab === 'channels')}
        ${renderModeration(activeTab === 'privacy')}
        ${renderDangerZone(activeTab === 'privacy')}
        ${renderAbout(activeTab === 'privacy')}
      </div>
    </div>
  `;
}

function renderProfile(identity, isActive = true) {
  return `
    <section class="settings-section" data-testid="profile-section" data-settings-tab="profile"${isActive ? '' : ' style="display:none"'}>
      <div class="section-title">Profile</div>
      <form id="profile-form" data-testid="profile-form">
        <div class="form-group">
          <label class="form-label" for="settings-name">Display Name</label>
          <input type="text" id="settings-name" class="form-input"
                 value="${escapeHtml(identity?.name ?? '')}"
                 placeholder="Your name" maxlength="50"
                 data-testid="settings-name-input" />
          <div class="form-count" id="name-count">${(identity?.name ?? '').length} / 50</div>
        </div>
        <div class="form-group">
          <label class="form-label" for="settings-bio">Bio</label>
          <textarea id="settings-bio" class="form-textarea"
                    placeholder="Tell others about yourself…" maxlength="200"
                    data-testid="settings-bio-input">${escapeHtml(identity?.bio ?? '')}</textarea>
          <div class="form-hint">Used for semantic peer matching</div>
          <div class="form-count" id="bio-count">${(identity?.bio ?? '').length} / 200</div>
        </div>
        <div class="form-group">
          <label class="form-label">Peer ID</label>
          <div class="form-static font-mono" data-testid="peer-id-display">
            ${identity?.peerId ? escapeHtml(identity.peerId) : 'Not initialized'}
          </div>
          <div class="form-hint">Your unique cryptographic identifier on the network</div>
        </div>
        <button type="submit" class="btn btn-primary" data-testid="save-profile-btn">Save Profile</button>
      </form>
    </section>
  `;
}

function renderIdentity(identity, isActive = true) {
  const identityId = identity?.peerId ?? identity?.pubkey;
  const fingerprint = identityId
    ? escapeHtml(identityId.slice(0, 8) + '…' + identityId.slice(-8))
    : 'N/A';
  const isEphemeral = localStorage.getItem('isc-ephemeral-session') === 'true';
  return `
    <section class="settings-section" data-testid="identity-section" data-settings-tab="profile"${isActive ? '' : ' style="display:none"'}>
      <div class="section-title">Identity</div>
      <div class="form-group">
        <label class="form-label">Fingerprint</label>
        <div class="form-static font-mono" data-testid="identity-fingerprint">${fingerprint}</div>
        <div class="form-hint">Short hash used to verify your identity</div>
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" id="export-identity" data-testid="export-identity">📥 Export</button>
        <label class="btn btn-secondary btn-import" data-testid="import-identity-label">
          📤 Import
          <input type="file" id="import-identity-file" accept=".json" class="hidden-input" data-testid="import-identity-input" />
        </label>
      </div>
      <div class="divider mt-4 mb-4"></div>
      <div class="toggle-row" data-testid="ephemeral-toggle-row">
        <div>
          <div class="toggle-label-text">Anonymous (ephemeral) session</div>
          <div class="toggle-hint">
            Identity exists only in this tab. Closing it permanently erases all data.
          </div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="ephemeral-toggle" ${isEphemeral ? 'checked' : ''}
                 data-testid="ephemeral-session-toggle" />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </section>
  `;
}

function renderThoughtConnections(isActive = true) {
  return `
    <section class="settings-section" data-testid="thought-connections-section" data-settings-tab="profile"${isActive ? '' : ' style="display:none"'}>
      <div class="section-title">Thought Connections</div>
      <div class="form-hint mb-3">
        Peers who have been thinking near you over time. Relationship insight — not a discovery feed.
      </div>
      <div id="thought-twin-container" data-testid="thought-twin-container">
        <div class="loading-hint">Loading…</div>
      </div>
      <div class="divider mt-4 mb-4"></div>
      <div class="section-subtitle mb-2">Bridge Moments</div>
      <div class="form-hint mb-3">Peers with similar-but-different thinking you haven't connected with yet.</div>
      <div id="bridge-moment-list" data-testid="bridge-moment-list">
        <div class="loading-hint">Loading…</div>
      </div>
    </section>
  `;
}

function renderDiscovery(settings, isActive = true) {
  return `
    <section class="settings-section" data-testid="discovery-section" data-settings-tab="network"${isActive ? '' : ' style="display:none"'}>
      <div class="section-title">Discovery</div>

      <div class="toggle-row">
        <div>
          <div class="toggle-label-text">Auto-discover peers</div>
          <div class="toggle-hint">Automatically search for matching peers</div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="auto-discover" ${settings.autoDiscover ? 'checked' : ''} data-testid="auto-discover-toggle" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="form-group mt-4">
        <label class="form-label" for="discover-interval">Discovery Interval</label>
        <select id="discover-interval" class="form-select" data-testid="discover-interval-select">
          <option value="15000"  ${settings.discoverInterval === 15000 ? 'selected' : ''}>15 seconds</option>
          <option value="30000"  ${settings.discoverInterval === 30000 ? 'selected' : ''}>30 seconds</option>
          <option value="60000"  ${settings.discoverInterval === 60000 ? 'selected' : ''}>1 minute</option>
          <option value="300000" ${settings.discoverInterval === 300000 ? 'selected' : ''}>5 minutes</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label" for="similarity-threshold">
          Similarity Threshold: <span id="sim-value">${Math.round((settings.similarityThreshold ?? 0.3) * 100)}</span>%
        </label>
        <input type="range" id="similarity-threshold" class="form-range"
               min="0" max="100" value="${Math.round((settings.similarityThreshold ?? 0.3) * 100)}"
               data-testid="similarity-threshold-slider" />
        <div class="form-hint">Minimum similarity to show as a match</div>
      </div>
    </section>
  `;
}

function renderAppearance(settings, isActive = true) {
  return `
    <section class="settings-section" data-testid="appearance-section" data-settings-tab="appearance"${isActive ? '' : ' style="display:none"'}>
      <div class="section-title">Appearance & Preferences</div>

      <div class="form-group">
        <label class="form-label" for="theme-select">Theme</label>
        <select id="theme-select" class="form-select" data-testid="theme-select">
          <option value="dark"   ${settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
          <option value="light"  ${settings.theme === 'light' ? 'selected' : ''}>Light</option>
          <option value="system" ${settings.theme === 'system' ? 'selected' : ''}>System</option>
        </select>
      </div>

      <div class="toggle-row">
        <div class="toggle-label-text">Enable notifications</div>
        <label class="toggle">
          <input type="checkbox" id="notifications-toggle" ${settings.notifications ? 'checked' : ''}
                 data-testid="notifications-toggle" role="switch" aria-checked="${settings.notifications}" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="toggle-row">
        <div class="toggle-label-text">Sound effects</div>
        <label class="toggle">
          <input type="checkbox" id="sound-toggle" ${settings.soundEnabled ? 'checked' : ''} data-testid="sound-toggle" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="toggle-row">
        <div class="toggle-label-text">Show online status</div>
        <label class="toggle">
          <input type="checkbox" id="show-online-toggle" ${settings.showOnline ? 'checked' : ''} data-testid="show-online-toggle" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="toggle-row">
        <div class="toggle-label-text">Allow direct messages</div>
        <label class="toggle">
          <input type="checkbox" id="allow-dms-toggle" ${settings.allowDMs ? 'checked' : ''} data-testid="allow-dms-toggle" />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </section>
  `;
}

function renderAdvanced(isActive = true) {
  const chaosLevel = parseInt(localStorage.getItem('isc:chaos-level') || '0', 10);
  const disableThoughtTwin = localStorage.getItem('isc:disable-thoughttwin') === 'true';

  return `
    <section class="settings-section" data-testid="advanced-section" data-settings-tab="network"${isActive ? '' : ' style="display:none"'}>
      <div class="section-title">Advanced</div>

      <div class="toggle-row">
        <div class="toggle-label-text">
          Serendipity mode
          <div class="text-xs text-muted">Discover unexpected peers (chaos level: ${chaosLevel}%)</div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="chaos-toggle" ${chaosLevel > 0 ? 'checked' : ''}
                 data-testid="chaos-toggle" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="toggle-row">
        <div class="toggle-label-text">
          ThoughtTwin suggestions
          <div class="text-xs text-muted">Show AI-powered peer suggestions</div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="thoughttwin-toggle" ${!disableThoughtTwin ? 'checked' : ''}
                 data-testid="thoughttwin-toggle" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="form-group">
        <label class="form-label">Chaos Level: <span id="chaos-value">${chaosLevel}%</span></label>
        <input type="range" id="chaos-slider" class="form-range" min="0" max="100" step="10"
               value="${chaosLevel}" data-testid="chaos-slider" />
        <div class="form-hint">Higher values introduce more randomness in peer discovery</div>
      </div>
    </section>
  `;
}

function renderChannels(channels, isActive = true) {
  return `
    <section class="settings-section" data-testid="channels-section" data-settings-tab="channels"${isActive ? '' : ' style="display:none"'}>
      <div class="section-title">My Channels (${channels.length})</div>
      ${
        channels.length === 0
          ? '<div class="text-muted text-sm">No channels created yet.</div>'
          : `<div data-testid="channels-list">
            ${channels
              .map(
                (ch) => `
              <div class="toggle-row" data-channel-id="${escapeHtml(ch.id)}">
                <span class="toggle-label-text font-mono">#${escapeHtml(ch.name)}</span>
                <div class="flex-row gap-2">
                  <button class="btn btn-secondary btn-sm edit-channel-btn" data-channel-id="${escapeHtml(ch.id)}"
                          data-testid="edit-channel-${escapeHtml(ch.id)}">Edit</button>
                  <button class="btn btn-danger btn-sm delete-channel-btn" data-channel-id="${escapeHtml(ch.id)}"
                          data-testid="delete-channel-${escapeHtml(ch.id)}">Delete</button>
                </div>
              </div>
            `
              )
              .join('')}
          </div>`
      }
    </section>
  `;
}

function renderDangerZone(isActive = true) {
  return `
    <section class="settings-section danger" data-testid="danger-zone" data-settings-tab="privacy"${isActive ? '' : ' style="display:none"'}>
      <div class="section-title text-danger">Danger Zone</div>
      <div class="section-description">These actions are irreversible and will delete your data.</div>
      <div class="form-actions">
        <button class="btn btn-danger" id="clear-data" data-testid="clear-data-btn">🗑️ Clear All Data</button>
        <button class="btn btn-danger" id="reset-identity-btn" data-testid="reset-identity-btn">🚪 Reset Identity</button>
      </div>
    </section>
  `;
}

function renderModeration(isActive = true) {
  const blockedPeers = [...moderationService.getBlockedPeers()];

  return `
    <section class="settings-section" data-testid="moderation-section" data-settings-tab="privacy"${isActive ? '' : ' style="display:none"'}>
      <div class="section-title">Blocked Peers</div>
      ${
        blockedPeers.length === 0
          ? `
        <div class="text-muted text-sm">No blocked peers. Block peers from their profile to hide their content.</div>
      `
          : `
        <div class="blocked-peers-list" data-testid="blocked-peers-list">
          ${blockedPeers
            .map(
              (peerId) => `
            <div class="blocked-peer-row" data-peer-id="${escapeHtml(peerId)}">
              <code class="blocked-peer-id font-mono">${escapeHtml(peerId.slice(0, 16))}…</code>
              <button class="btn btn-ghost btn-sm unblock-btn" data-peer-id="${escapeHtml(peerId)}"
                      data-testid="unblock-${escapeHtml(peerId.slice(0, 8))}">
                Unblock
              </button>
            </div>
          `
            )
            .join('')}
        </div>
      `
      }
    </section>
  `;
}

function renderShare(isActive = true) {
  const identity = identityService.getIdentity();
  const peerId = identity?.peerId ?? identity?.pubkey;
  const inviteUrl = peerId
    ? `${window.location.origin}/#/join?peer=${encodeURIComponent(peerId)}`
    : '';

  return `
    <section class="settings-section" data-testid="share-section" data-settings-tab="appearance"${isActive ? '' : ' style="display:none"'}>
      <div class="section-title">Share & Invite</div>
      <div class="form-group">
        <label class="form-label">Your Invite Link</label>
        <div class="invite-link-row">
          <code class="invite-link font-mono" data-testid="invite-link">
            ${inviteUrl ? escapeHtml(inviteUrl) : 'Generate after identity is created'}
          </code>
          <button class="btn btn-ghost btn-sm" id="copy-invite-btn" data-testid="copy-invite-btn"
                  ${!inviteUrl ? 'disabled' : ''} title="Copy to clipboard">📋 Copy</button>
        </div>
        <div class="form-hint">Share this link with others to connect directly with you</div>
      </div>
      <div class="form-group">
        <label class="form-label">Share via</label>
        <div class="share-buttons" data-testid="share-buttons">
          <button class="btn btn-ghost btn-sm share-btn" data-share="twitter" data-testid="share-twitter">
            𝕏 Twitter
          </button>
          <button class="btn btn-ghost btn-sm share-btn" data-share="mastodon" data-testid="share-mastodon">
            🐘 Mastodon
          </button>
          <button class="btn btn-ghost btn-sm share-btn" data-share="email" data-testid="share-email">
            ✉️ Email
          </button>
        </div>
      </div>
    </section>
  `;
}

function renderAbout(isActive = true) {
  return `
    <section class="settings-section card-blue" data-testid="about-section" data-settings-tab="privacy"${isActive ? '' : ' style="display:none"'}>
      <div class="section-title text-brand">About ISC</div>
      <div class="about-text">
        <div><strong>ISC</strong> — Internet Semantic Chat</div>
        <div>Version 1.0.0 · Phase 1</div>
        <div class="about-description">
          Fully decentralized P2P platform. No accounts. No central servers.<br>
          Your thoughts are embedded locally by a tiny LLM running in your browser.<br>
          Only vectors — never raw text — are announced to the P2P network.
        </div>
      </div>
      <div class="about-links mt-4">
        <span class="about-link" title="libp2p + Kademlia DHT + WebRTC">Stack: libp2p · kad-dht · WebRTC · Transformers.js</span>
      </div>
    </section>
  `;
}

function showInlineSaved(nearEl) {
  const msg = document.createElement('span');
  msg.className = 'inline-saved-msg';
  msg.textContent = '✓ Saved';
  nearEl?.after(msg);
  setTimeout(() => msg.remove(), 1500);
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

export function bind(container) {
  destroy();
  applyTheme(settingsService.get().theme ?? 'dark');

  container.querySelectorAll('.settings-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      localStorage.setItem('isc:settings-tab', tabName);
      container.querySelectorAll('.settings-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      container
        .querySelectorAll('[data-settings-tab]')
        .forEach((s) => (s.style.display = s.dataset.settingsTab === tabName ? 'block' : 'none'));
    });
  });

  const thoughtTwinContainer = container.querySelector('#thought-twin-container');
  if (thoughtTwinContainer) {
    getTopSimilarPeers(10)
      .then((peers) => {
        const twin = peers.find((p) => p.days >= 7);
        thoughtTwinContainer.innerHTML = twin
          ? `
        <div class="thought-twin-card" data-testid="thought-twin-card">
          <div class="thought-twin-label">Your Thought Twin</div>
          <div class="thought-twin-info">
            <span class="thought-twin-peer font-mono">${escapeHtml(twin.peerId.slice(0, 12))}…</span>
            <span class="thought-twin-duration">${twin.days} day${twin.days === 1 ? '' : 's'} of co-presence</span>
          </div>
          <button class="btn btn-sm btn-ghost" data-dm-peer="${escapeHtml(twin.peerId)}" data-testid="thought-twin-dm">Say hello →</button>
        </div>`
          : '<div class="settings-hint">No thought twin yet — spend 7+ days in channels to find yours.</div>';
        thoughtTwinContainer.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-dm-peer]');
          if (btn) {
            document.dispatchEvent(
              new CustomEvent('isc:start-chat', { detail: { peerId: btn.dataset.dmPeer } })
            );
            window.location.hash = '#/chats';
          }
        });
      })
      .catch(() => {
        thoughtTwinContainer.innerHTML =
          '<div class="settings-hint">Could not load thought twin.</div>';
      });
  }

  const bridgeList = container.querySelector('#bridge-moment-list');
  if (bridgeList) {
    getBridgeMomentCandidates()
      .then((candidates) => {
        if (!candidates?.length) {
          bridgeList.innerHTML =
            '<div class="settings-hint">No thought connections yet — spend more time in channels to build proximity history.</div>';
          return;
        }
        bridgeList.innerHTML = candidates
          .map(
            (c) => `
        <div class="bridge-moment-item" data-testid="bridge-moment-${escapeHtml(c.peerId)}">
          <div class="bridge-moment-info">
            <span class="bridge-moment-name">${escapeHtml(c.name || 'Anonymous')}</span>
            <span class="bridge-moment-desc">${escapeHtml((c.description || '').slice(0, 80))}</span>
            <span class="bridge-moment-duration">Near you for ${c.days != null ? `${c.days} day${c.days === 1 ? '' : 's'}` : 'a while'}</span>
          </div>
          <button class="btn btn-sm btn-ghost" data-dm-peer="${escapeHtml(c.peerId)}" data-testid="bridge-dm-${escapeHtml(c.peerId)}">Say hello →</button>
        </div>`
          )
          .join('');
        bridgeList.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-dm-peer]');
          if (btn) {
            document.dispatchEvent(
              new CustomEvent('isc:start-chat', { detail: { peerId: btn.dataset.dmPeer } })
            );
            window.location.hash = '#/chats';
          }
        });
      })
      .catch(() => {
        bridgeList.innerHTML =
          '<div class="settings-hint">Could not load thought connections.</div>';
      });
  }

  // Profile form
  const profileForm = container.querySelector('#profile-form');
  const profileHandler = async (e) => {
    e.preventDefault();
    const name = container.querySelector('#settings-name')?.value.trim();
    const bio = container.querySelector('#settings-bio')?.value.trim();
    try {
      await identityService.update({ name, bio });
      toasts.success('Profile saved!');
    } catch (err) {
      toasts.error(`Failed to save: ${err.message}`);
    }
  };
  if (profileForm) trackListener(profileForm, 'submit', profileHandler);

  // Character counters
  const nameInput = container.querySelector('#settings-name');
  const nameHandler = (e) => {
    const n = container.querySelector('#name-count');
    if (n) n.textContent = `${e.target.value.length} / 50`;
  };
  if (nameInput) trackListener(nameInput, 'input', nameHandler);

  const bioInput = container.querySelector('#settings-bio');
  const bioHandler = (e) => {
    const n = container.querySelector('#bio-count');
    if (n) n.textContent = `${e.target.value.length} / 200`;
  };
  if (bioInput) trackListener(bioInput, 'input', bioHandler);

  // Export identity
  const exportBtn = container.querySelector('#export-identity');
  const exportHandler = () => {
    const data = identityService.export();
    if (!data) {
      toasts.error('No identity to export');
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `isc-identity-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toasts.success('Identity exported!');
  };
  if (exportBtn) trackListener(exportBtn, 'click', exportHandler);

  // Import identity
  const importInput = container.querySelector('#import-identity-file');
  const importHandler = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = await modals.confirm(
      'Importing will replace your current identity. Back it up first. Continue?',
      { title: '⚠️ Import Identity', confirmText: 'Import', danger: true }
    );
    if (!ok) return;
    try {
      const data = JSON.parse(await file.text());
      await identityService.import(data);
      toasts.success('Identity imported! Reloading…');
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      toasts.error(`Import failed: ${err.message}`);
    }
  };
  if (importInput) trackListener(importInput, 'change', importHandler);

  // Ephemeral session toggle
  const ephemeralToggle = container.querySelector('#ephemeral-toggle');
  const ephemeralHandler = (e) => {
    if (e.target.checked) {
      localStorage.setItem('isc-ephemeral-session', 'true');
    } else {
      localStorage.removeItem('isc-ephemeral-session');
    }
    showInlineSaved(e.target.closest('.toggle-row'));
  };
  if (ephemeralToggle) trackListener(ephemeralToggle, 'change', ephemeralHandler);

  const chaosToggle = container.querySelector('#chaos-toggle');
  const chaosToggleHandler = (e) => {
    const level = e.target.checked ? 50 : 0;
    localStorage.setItem('isc:chaos-level', String(level));
    document.dispatchEvent(new CustomEvent('isc:toggle-chaos', { detail: { level } }));
    showInlineSaved(e.target.closest('.toggle-row'));
  };
  if (chaosToggle) trackListener(chaosToggle, 'change', chaosToggleHandler);

  const thoughttwinToggle = container.querySelector('#thoughttwin-toggle');
  const thoughttwinHandler = (e) => {
    localStorage.setItem('isc:disable-thoughttwin', String(!e.target.checked));
    showInlineSaved(e.target.closest('.toggle-row'));
    toasts.info(
      e.target.checked ? 'ThoughtTwin suggestions enabled' : 'ThoughtTwin suggestions disabled'
    );
  };
  if (thoughttwinToggle) trackListener(thoughttwinToggle, 'change', thoughttwinHandler);

  const chaosSlider = container.querySelector('#chaos-slider');
  const chaosSliderHandler = (e) => {
    const valueEl = container.querySelector('#chaos-value');
    if (valueEl) valueEl.textContent = `${e.target.value}%`;
    localStorage.setItem('isc:chaos-level', e.target.value);
    document.dispatchEvent(
      new CustomEvent('isc:toggle-chaos', { detail: { level: parseInt(e.target.value, 10) } })
    );
  };
  if (chaosSlider) trackListener(chaosSlider, 'input', chaosSliderHandler);

  // Discovery settings
  const autoDiscover = container.querySelector('#auto-discover');
  const autoDiscoverHandler = (e) => {
    settingsService.set({ autoDiscover: e.target.checked });
    showInlineSaved(e.target);
  };
  if (autoDiscover) trackListener(autoDiscover, 'change', autoDiscoverHandler);

  const discoverInterval = container.querySelector('#discover-interval');
  const discoverIntervalHandler = (e) => {
    settingsService.set({ discoverInterval: parseInt(e.target.value, 10) });
    showInlineSaved(e.target);
  };
  if (discoverInterval) trackListener(discoverInterval, 'change', discoverIntervalHandler);

  const similarityThreshold = container.querySelector('#similarity-threshold');
  const similarityHandler = (e) => {
    const v = container.querySelector('#sim-value');
    if (v) v.textContent = e.target.value;
    settingsService.set({ similarityThreshold: parseInt(e.target.value, 10) / 100 });
  };
  if (similarityThreshold) trackListener(similarityThreshold, 'input', similarityHandler);

  // Preference toggles (live-save)
  const liveSettingsMap = {
    'theme-select': 'theme',
    'notifications-toggle': 'notifications',
    'sound-toggle': 'soundEnabled',
    'show-online-toggle': 'showOnline',
    'allow-dms-toggle': 'allowDMs',
  };

  Object.keys(liveSettingsMap).forEach((id) => {
    const el = container.querySelector(`#${id}`);
    const key = liveSettingsMap[id];
    const handler = (e) => {
      if (key) {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        settingsService.set({ [key]: value });
        if (key === 'theme') applyTheme(value);
        showInlineSaved(e.target);
      }
    };
    if (el) trackListener(el, 'change', handler);
  });

  // Request browser notification permission when the toggle is first enabled
  const notificationsToggle = container.querySelector('#notifications-toggle');
  const notificationsHandler = async (e) => {
    if (!e.target.checked || !('Notification' in window)) return;
    if (Notification.permission === 'granted') return; // already have permission
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      e.target.checked = false;
      settingsService.set({ notifications: false });
      toasts.warning(
        'Notification permission denied — enable it in browser settings to receive alerts'
      );
    } else {
      toasts.success("Notifications enabled! You'll be alerted when messages arrive.");
    }
  };
  if (notificationsToggle) trackListener(notificationsToggle, 'change', notificationsHandler);

  // Delete channel / Edit channel
  const channelHandler = async (e) => {
    const deleteBtn = e.target.closest('.delete-channel-btn');
    if (deleteBtn) {
      const chId = deleteBtn.dataset.channelId;
      const ok = await modals.confirm('Delete this channel? This cannot be undone.', {
        title: '🗑️ Delete Channel',
        confirmText: 'Delete',
        danger: true,
      });
      if (!ok) return;
      try {
        await channelService.delete(chId);
        toasts.success('Channel deleted');
        deleteBtn.closest('[data-channel-id]')?.remove();
      } catch (err) {
        toasts.error(err.message);
      }
      return;
    }

    // Edit channel - open modal
    const editBtn = e.target.closest('.edit-channel-btn');
    if (editBtn) {
      const channel = channelService.getById(editBtn.dataset.channelId);
      if (channel) showEditModal(channel);
    }
  };
  trackListener(container, 'click', channelHandler);

  const copyBtn = container.querySelector('#copy-invite-btn');
  const copyHandler = async () => {
    const inviteLink = container.querySelector('.invite-link')?.textContent.trim();
    if (!inviteLink || inviteLink.includes('Generate')) {
      toasts.error('No invite link available');
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteLink);
      toasts.success('Invite link copied!');
    } catch {
      toasts.error('Could not copy to clipboard');
    }
  };
  if (copyBtn) trackListener(copyBtn, 'click', copyHandler);

  const shareButtons = container.querySelector('.share-buttons');
  const shareHandler = (e) => {
    const btn = e.target.closest('.share-btn');
    if (!btn) return;

    const identity = identityService.getIdentity();
    const peerId = identity?.peerId ?? identity?.pubkey;
    if (!peerId) {
      toasts.error('Identity not ready');
      return;
    }

    const inviteUrl = `${window.location.origin}/#/join?peer=${encodeURIComponent(peerId)}`;
    const text = encodeURIComponent(`Join me on ISC! Connect directly: ${inviteUrl}`);

    const shareUrls = {
      twitter: `https://twitter.com/intent/tweet?text=${text}`,
      mastodon: `https://mastodon.social/share?text=${text}`,
      email: `mailto:?subject=Join%20me%20on%20ISC&body=${text}`,
    };

    const url = shareUrls[btn.dataset.share];
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };
  if (shareButtons) trackListener(shareButtons, 'click', shareHandler);

  const blockedList = container.querySelector('.blocked-peers-list');
  const unblockHandler = (e) => {
    const unblockBtn = e.target.closest('.unblock-btn');
    if (unblockBtn) {
      const peerId = unblockBtn.dataset.peerId;
      moderationService.unblock(peerId);
      toasts.success('Peer unblocked');
      setTimeout(() => {
        const body = container.querySelector('[data-testid="settings-content"]');
        if (body) body.innerHTML = render();
        bind(container);
      }, 100);
    }
  };
  if (blockedList) trackListener(blockedList, 'click', unblockHandler);

  // Clear all data
  const clearDataBtn = container.querySelector('#clear-data');
  const clearDataHandler = async () => {
    const ok = await modals.confirm(
      'This removes all your channels, posts, conversations, settings, and identity ' +
        'from this browser. It cannot be undone. Consider exporting your identity first.',
      {
        title: 'Clear All Local Data',
        confirmText: 'Clear Everything',
        danger: true,
      }
    );
    if (!ok) return;
    localStorage.clear();
    // Also clear IndexedDB where channels, posts, matches, and identity are stored
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('isc-storage');
      req.onsuccess = req.onerror = req.onblocked = () => resolve(undefined);
    });
    toasts.success('All data cleared. Reloading…');
    setTimeout(() => location.reload(), 1500);
  };
  if (clearDataBtn) trackListener(clearDataBtn, 'click', clearDataHandler);

  const resetBtn = container.querySelector('#reset-identity-btn');
  const resetHandler = async () => {
    const ok = await modals.confirm(
      'This generates a brand-new cryptographic identity on next launch. ' +
        'Your channels and conversations will be lost unless you export first.',
      {
        title: 'Reset Identity',
        confirmText: 'Reset',
        cancelText: 'Cancel',
        danger: true,
      }
    );
    if (!ok) return;
    try {
      await identityService.clear();
      toasts.success('Identity reset. Reloading…');
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      toasts.error(err.message);
    }
  };
  if (resetBtn) trackListener(resetBtn, 'click', resetHandler);

  return [];
}

const listeners = [];

function trackListener(target, event, handler) {
  listeners.push({ target, event, handler });
  target.addEventListener(event, handler);
}

export function update(container) {
  const section = container.querySelector('[data-testid="channels-section"]');
  if (!section) return;
  const channels = channelService.getAll();
  const tmp = document.createElement('div');
  tmp.innerHTML = renderChannels(channels);
  const newSection = tmp.firstElementChild;
  if (newSection) section.replaceWith(newSection);
}

export function destroy() {
  listeners.forEach(({ target, event, handler }) => {
    target.removeEventListener(event, handler);
  });
  listeners.length = 0;
}
