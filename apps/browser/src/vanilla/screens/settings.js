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
import { escapeHtml } from '../../utils/dom.js';
import { toasts } from '../../utils/toast.js';
import { modals } from '../components/modal.js';
import { showEditModal } from '../components/mixerPanel.js';
import { createScreen } from '../utils/screen.js';
import { getBridgeMomentCandidates, getTopSimilarPeers } from '../../services/peerProximity.ts';

export function render() {
  const identity = identityService.getIdentity();
  const settings = settingsService.get();
  const channels = channelService.getAll();
  const netStatus = networkService.getStatus();
  const connected = netStatus?.connected ?? false;

  return `
    <div class="screen settings-screen" data-testid="settings-screen">
      <div class="screen-header" data-testid="settings-header">
        <h1 class="screen-title" data-testid="settings-title">⚙️ Settings</h1>
        <span class="status-badge ${connected ? 'online' : 'offline'}" data-testid="settings-status">
          ${connected ? '● Online' : '○ Offline'}
        </span>
      </div>

      <div class="screen-body" data-testid="settings-content">
        ${renderProfile(identity)}
        ${renderIdentity(identity)}
        ${renderThoughtConnections()}
        ${renderDiscovery(settings)}
        ${renderAppearance(settings)}
        ${renderAdvanced(settings)}
        ${renderModeration()}
        ${renderShare()}
        ${renderChannels(channels)}
        ${renderDangerZone()}
        ${renderAbout()}
      </div>
    </div>
  `;
}

function renderProfile(identity) {
  return `
    <section class="settings-section" data-testid="profile-section">
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

function renderIdentity(identity) {
  const identityId = identity?.peerId ?? identity?.pubkey;
  const fingerprint = identityId
    ? escapeHtml(identityId.slice(0, 8) + '…' + identityId.slice(-8))
    : 'N/A';
  const isEphemeral = localStorage.getItem('isc-ephemeral-session') === 'true';
  return `
    <section class="settings-section" data-testid="identity-section">
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

function renderThoughtConnections() {
  return `
    <section class="settings-section" data-testid="thought-connections-section">
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

function renderDiscovery(settings) {
  return `
    <section class="settings-section" data-testid="discovery-section">
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

function renderAppearance(settings) {
  return `
    <section class="settings-section" data-testid="appearance-section">
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

function renderAdvanced(settings) {
  const chaosLevel = parseInt(localStorage.getItem('isc:chaos-level') || '0', 10);
  const demoModeActive = localStorage.getItem('isc:demo-mode') !== 'false';
  const disableThoughtTwin = localStorage.getItem('isc:disable-thoughttwin') === 'true';

  return `
    <section class="settings-section" data-testid="advanced-section">
      <div class="section-title">Advanced</div>

      <div class="toggle-row">
        <div class="toggle-label-text">
          Ephemeral session
          <div class="text-xs text-muted">Clear all data when closing the tab</div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="ephemeral-toggle" ${settings.ephemeral ? 'checked' : ''}
                 data-testid="ephemeral-toggle" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="toggle-row">
        <div class="toggle-label-text">
          Demo mode (ghost peers)
          <div class="text-xs text-muted">Show synthetic peers for testing</div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="demo-mode-toggle" ${demoModeActive ? 'checked' : ''}
                 data-testid="demo-mode-toggle" />
          <span class="toggle-slider"></span>
        </label>
      </div>

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

function renderChannels(channels) {
  return `
    <section class="settings-section" data-testid="channels-section">
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

function renderDangerZone() {
  return `
    <section class="settings-section danger" data-testid="danger-zone">
      <div class="section-title text-danger">Danger Zone</div>
      <div class="section-description">These actions are irreversible and will delete your data.</div>
      <div class="form-actions">
        <button class="btn btn-danger" id="clear-data" data-testid="clear-data-btn">🗑️ Clear All Data</button>
        <button class="btn btn-danger" id="reset-identity-btn" data-testid="reset-identity-btn">🚪 Reset Identity</button>
      </div>
    </section>
  `;
}

function renderModeration() {
  const blockedPeers = [...moderationService.getBlockedPeers()];

  return `
    <section class="settings-section" data-testid="moderation-section">
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

function renderShare() {
  const identity = identityService.getIdentity();
  const peerId = identity?.peerId ?? identity?.pubkey;
  const inviteUrl = peerId
    ? `${window.location.origin}/#/join?peer=${encodeURIComponent(peerId)}`
    : '';

  return `
    <section class="settings-section" data-testid="share-section">
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

function renderAbout() {
  return `
    <section class="settings-section card-blue" data-testid="about-section">
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
  // Apply current theme
  applyTheme(settingsService.get().theme ?? 'dark');

  // Load Thought Twin asynchronously (most consistently co-present peer, 7+ days)
  const thoughtTwinContainer = container.querySelector('#thought-twin-container');
  if (thoughtTwinContainer) {
    getTopSimilarPeers(10).then((peers) => {
      const twin = peers.find(p => p.days >= 7);
      if (!twin) {
        thoughtTwinContainer.innerHTML = '<div class="settings-hint">No thought twin yet — spend 7+ days in channels to find yours.</div>';
        return;
      }
      thoughtTwinContainer.innerHTML = `
        <div class="thought-twin-card" data-testid="thought-twin-card">
          <div class="thought-twin-label">Your Thought Twin</div>
          <div class="thought-twin-info">
            <span class="thought-twin-peer font-mono">${escapeHtml(twin.peerId.slice(0, 12))}…</span>
            <span class="thought-twin-duration">${twin.days} day${twin.days !== 1 ? 's' : ''} of co-presence</span>
          </div>
          <button class="btn btn-sm btn-ghost" data-dm-peer="${escapeHtml(twin.peerId)}" data-testid="thought-twin-dm">
            Say hello →
          </button>
        </div>
      `;
      thoughtTwinContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-dm-peer]');
        if (!btn) return;
        document.dispatchEvent(new CustomEvent('isc:start-chat', { detail: { peerId: btn.dataset.dmPeer } }));
        window.location.hash = '#/chats';
      });
    }).catch(() => {
      thoughtTwinContainer.innerHTML = '<div class="settings-hint">Could not load thought twin.</div>';
    });
  }

  // Load Bridge Moment / Thought Connections section asynchronously
  const bridgeList = container.querySelector('#bridge-moment-list');
  if (bridgeList) {
    getBridgeMomentCandidates().then((candidates) => {
      if (!candidates || candidates.length === 0) {
        bridgeList.innerHTML = '<div class="settings-hint">No thought connections yet — spend more time in channels to build proximity history.</div>';
        return;
      }
      bridgeList.innerHTML = candidates.map(c => `
        <div class="bridge-moment-item" data-testid="bridge-moment-${escapeHtml(c.peerId)}">
          <div class="bridge-moment-info">
            <span class="bridge-moment-name">${escapeHtml(c.name || 'Anonymous')}</span>
            <span class="bridge-moment-desc">${escapeHtml((c.description || '').slice(0, 80))}</span>
            <span class="bridge-moment-duration">Near you for ${c.days != null ? `${c.days} day${c.days !== 1 ? 's' : ''}` : 'a while'}</span>
          </div>
          <button class="btn btn-sm btn-ghost" data-dm-peer="${escapeHtml(c.peerId)}" data-testid="bridge-dm-${escapeHtml(c.peerId)}">
            Say hello →
          </button>
        </div>
      `).join('');

      bridgeList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-dm-peer]');
        if (btn) {
          const peerId = btn.dataset.dmPeer;
          document.dispatchEvent(new CustomEvent('isc:start-chat', { detail: { peerId } }));
          window.location.hash = '#/chats';
        }
      });
    }).catch(() => {
      bridgeList.innerHTML = '<div class="settings-hint">Could not load thought connections.</div>';
    });
  }

  // Profile form
  container.querySelector('#profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = container.querySelector('#settings-name')?.value.trim();
    const bio = container.querySelector('#settings-bio')?.value.trim();
    try {
      await identityService.update({ name, bio });
      toasts.success('Profile saved!');
    } catch (err) {
      toasts.error(`Failed to save: ${err.message}`);
    }
  });

  // Character counters
  container.querySelector('#settings-name')?.addEventListener('input', (e) => {
    const n = container.querySelector('#name-count');
    if (n) n.textContent = `${e.target.value.length} / 50`;
  });
  container.querySelector('#settings-bio')?.addEventListener('input', (e) => {
    const n = container.querySelector('#bio-count');
    if (n) n.textContent = `${e.target.value.length} / 200`;
  });

  // Export identity
  container.querySelector('#export-identity')?.addEventListener('click', () => {
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
  });

  // Import identity
  container.querySelector('#import-identity-file')?.addEventListener('change', async (e) => {
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
  });

  // Ephemeral session toggle
  container.querySelector('#ephemeral-toggle')?.addEventListener('change', (e) => {
    if (e.target.checked) {
      localStorage.setItem('isc-ephemeral-session', 'true');
    } else {
      localStorage.removeItem('isc-ephemeral-session');
    }
    showInlineSaved(e.target.closest('.toggle-row'));
  });

  container.querySelector('#demo-mode-toggle')?.addEventListener('change', (e) => {
    localStorage.setItem('isc:demo-mode', String(e.target.checked));
    showInlineSaved(e.target.closest('.toggle-row'));
    toasts.info(e.target.checked ? 'Demo mode enabled' : 'Demo mode disabled');
  });

  container.querySelector('#chaos-toggle')?.addEventListener('change', (e) => {
    const level = e.target.checked ? 50 : 0;
    localStorage.setItem('isc:chaos-level', String(level));
    document.dispatchEvent(new CustomEvent('isc:toggle-chaos', { detail: { level } }));
    showInlineSaved(e.target.closest('.toggle-row'));
  });

  container.querySelector('#thoughttwin-toggle')?.addEventListener('change', (e) => {
    localStorage.setItem('isc:disable-thoughttwin', String(!e.target.checked));
    showInlineSaved(e.target.closest('.toggle-row'));
    toasts.info(
      e.target.checked ? 'ThoughtTwin suggestions enabled' : 'ThoughtTwin suggestions disabled'
    );
  });

  container.querySelector('#chaos-slider')?.addEventListener('input', (e) => {
    const valueEl = container.querySelector('#chaos-value');
    if (valueEl) valueEl.textContent = `${e.target.value}%`;
    localStorage.setItem('isc:chaos-level', e.target.value);
    document.dispatchEvent(
      new CustomEvent('isc:toggle-chaos', { detail: { level: parseInt(e.target.value, 10) } })
    );
  });

  // Discovery settings
  container.querySelector('#similarity-threshold')?.addEventListener('input', (e) => {
    const v = container.querySelector('#sim-value');
    if (v) v.textContent = e.target.value;
  });

  container.querySelector('#auto-discover')?.addEventListener('change', (e) => {
    settingsService.set({ autoDiscover: e.target.checked });
    showInlineSaved(e.target);
  });

  container.querySelector('#discover-interval')?.addEventListener('change', (e) => {
    settingsService.set({ discoverInterval: parseInt(e.target.value, 10) });
    showInlineSaved(e.target);
  });

  container.querySelector('#similarity-threshold')?.addEventListener('input', (e) => {
    const v = container.querySelector('#sim-value');
    if (v) v.textContent = e.target.value;
    settingsService.set({ similarityThreshold: parseInt(e.target.value, 10) / 100 });
  });

  // Preference toggles (live-save)
  const liveSettings = [
    'theme-select',
    'notifications-toggle',
    'sound-toggle',
    'show-online-toggle',
    'allow-dms-toggle',
  ];
  liveSettings.forEach((id) => {
    container.querySelector(`#${id}`)?.addEventListener('change', (e) => {
      const key = {
        'theme-select': 'theme',
        'notifications-toggle': 'notifications',
        'sound-toggle': 'soundEnabled',
        'show-online-toggle': 'showOnline',
        'allow-dms-toggle': 'allowDMs',
      }[id];
      if (key) {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        settingsService.set({ [key]: value });
        if (key === 'theme') applyTheme(value);
        showInlineSaved(e.target);
      }
    });
  });

  // Request browser notification permission when the toggle is first enabled
  container.querySelector('#notifications-toggle')?.addEventListener('change', async (e) => {
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
  });

  // Delete channel
  container.addEventListener('click', async (e) => {
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
  });

  container.querySelector('#copy-invite-btn')?.addEventListener('click', async () => {
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
  });

  container.querySelector('.share-buttons')?.addEventListener('click', (e) => {
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
  });

  container.querySelector('.blocked-peers-list')?.addEventListener('click', (e) => {
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
  });

  // Clear all data
  container.querySelector('#clear-data')?.addEventListener('click', async () => {
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
  });

  container.querySelector('#reset-identity-btn')?.addEventListener('click', async () => {
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
  });

  return [];
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
  // No cleanup needed for settings screen
}

export default createScreen({ render, bind, update, destroy });
