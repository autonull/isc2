/**
 * Settings Screen — Identity, discovery, preferences, danger zone
 */

import { identityService, settingsService, channelService } from '../../services/index.js';
import { networkService } from '../../services/network.js';
import { escapeHtml } from '../../utils/dom.js';
import { toasts } from '../../utils/toast.js';
import { modals } from '../components/modal.js';

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
        ${renderDiscovery(settings)}
        ${renderAppearance(settings)}
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
      <div class="section-title">👤 Profile</div>
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
  return `
    <section class="settings-section" data-testid="identity-section">
      <div class="section-title">🔐 Identity</div>
      <div class="form-group">
        <label class="form-label">Fingerprint</label>
        <div class="form-static font-mono" data-testid="identity-fingerprint">${fingerprint}</div>
        <div class="form-hint">Short hash used to verify your identity</div>
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" id="export-identity" data-testid="export-identity">📥 Export</button>
        <label class="btn btn-secondary" style="cursor:pointer" data-testid="import-identity-label">
          📤 Import
          <input type="file" id="import-identity-file" accept=".json" style="display:none" data-testid="import-identity-input" />
        </label>
      </div>
    </section>
  `;
}

function renderDiscovery(settings) {
  return `
    <section class="settings-section" data-testid="discovery-section">
      <div class="section-title">📡 Discovery</div>

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
          <option value="15000"  ${settings.discoverInterval === 15000  ? 'selected' : ''}>15 seconds</option>
          <option value="30000"  ${settings.discoverInterval === 30000  ? 'selected' : ''}>30 seconds</option>
          <option value="60000"  ${settings.discoverInterval === 60000  ? 'selected' : ''}>1 minute</option>
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

      <button class="btn btn-primary" id="save-discovery" data-testid="save-discovery-btn">Save Discovery Settings</button>
    </section>
  `;
}

function renderAppearance(settings) {
  return `
    <section class="settings-section" data-testid="appearance-section">
      <div class="section-title">🎨 Appearance & Preferences</div>

      <div class="form-group">
        <label class="form-label" for="theme-select">Theme</label>
        <select id="theme-select" class="form-select" data-testid="theme-select">
          <option value="dark"   ${settings.theme === 'dark'   ? 'selected' : ''}>Dark</option>
          <option value="light"  ${settings.theme === 'light'  ? 'selected' : ''}>Light</option>
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

      <div class="form-actions">
        <button class="btn btn-primary" id="save-preferences" data-testid="save-preferences-btn">Save Preferences</button>
      </div>
    </section>
  `;
}

function renderChannels(channels) {
  return `
    <section class="settings-section" data-testid="channels-section">
      <div class="section-title">📢 Your Channels (${channels.length})</div>
      ${channels.length === 0
        ? '<div class="text-muted" style="font-size:13px">No channels created yet.</div>'
        : `<div data-testid="channels-list">
            ${channels.map(ch => `
              <div class="toggle-row" data-channel-id="${escapeHtml(ch.id)}">
                <span class="toggle-label-text" style="font-family:var(--font-mono)">#${escapeHtml(ch.name)}</span>
                <button class="btn btn-danger btn-sm delete-channel-btn" data-channel-id="${escapeHtml(ch.id)}"
                        data-testid="delete-channel-${escapeHtml(ch.id)}">Delete</button>
              </div>
            `).join('')}
          </div>`
      }
    </section>
  `;
}

function renderDangerZone() {
  return `
    <section class="settings-section danger" data-testid="danger-zone">
      <div class="section-title text-danger">⚠️ Danger Zone</div>
      <div class="section-description">These actions are irreversible and will delete your data.</div>
      <div class="form-actions">
        <button class="btn btn-danger" id="clear-data" data-testid="clear-data-btn">🗑️ Clear All Data</button>
        <button class="btn btn-danger" id="logout-btn" data-testid="logout-btn">🚪 Logout</button>
      </div>
    </section>
  `;
}

function renderAbout() {
  return `
    <section class="settings-section card-blue" data-testid="about-section">
      <div class="section-title text-brand">ℹ️ About ISC</div>
      <div style="font-size:13px;color:var(--c-text-dim);line-height:2">
        <div><strong>ISC</strong> — Internet Semantic Chat</div>
        <div>Version 1.0.0 · Phase 1</div>
        <div style="margin-top:8px;font-size:12px;line-height:1.7;color:var(--c-text-muted)">
          Fully decentralized P2P platform. No accounts. No central servers.<br>
          Your thoughts are embedded locally by a tiny LLM running in your browser.<br>
          Only vectors — never raw text — are announced to the P2P network.
        </div>
      </div>
      <div class="about-links mt-4">
        <a href="https://github.com/isc2" target="_blank" rel="noopener" class="about-link">GitHub</a>
        <span class="text-muted">·</span>
        <span class="about-link" style="cursor:default" title="libp2p + Kademlia DHT + WebRTC">Stack: libp2p · kad-dht · WebRTC · Transformers.js</span>
      </div>
    </section>
  `;
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

  // Profile form
  container.querySelector('#profile-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const name = container.querySelector('#settings-name')?.value.trim();
    const bio  = container.querySelector('#settings-bio')?.value.trim();
    try {
      await identityService.update({ name, bio });
      toasts.success('Profile saved!');
    } catch (err) {
      toasts.error(`Failed to save: ${err.message}`);
    }
  });

  // Character counters
  container.querySelector('#settings-name')?.addEventListener('input', e => {
    const n = container.querySelector('#name-count');
    if (n) n.textContent = `${e.target.value.length} / 50`;
  });
  container.querySelector('#settings-bio')?.addEventListener('input', e => {
    const n = container.querySelector('#bio-count');
    if (n) n.textContent = `${e.target.value.length} / 200`;
  });

  // Export identity
  container.querySelector('#export-identity')?.addEventListener('click', () => {
    const data = identityService.export();
    if (!data) { toasts.error('No identity to export'); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `isc-identity-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    toasts.success('Identity exported!');
  });

  // Import identity
  container.querySelector('#import-identity-file')?.addEventListener('change', async e => {
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

  // Discovery settings
  container.querySelector('#similarity-threshold')?.addEventListener('input', e => {
    const v = container.querySelector('#sim-value');
    if (v) v.textContent = e.target.value;
  });

  container.querySelector('#save-discovery')?.addEventListener('click', () => {
    settingsService.set({
      autoDiscover:        container.querySelector('#auto-discover')?.checked ?? true,
      discoverInterval:    parseInt(container.querySelector('#discover-interval')?.value ?? '30000', 10),
      similarityThreshold: (parseInt(container.querySelector('#similarity-threshold')?.value ?? '30', 10)) / 100,
    });
    toasts.success('Discovery settings saved!');
  });

  // Preference toggles (live-save)
  const liveSettings = ['theme-select', 'notifications-toggle', 'sound-toggle', 'show-online-toggle', 'allow-dms-toggle'];
  liveSettings.forEach(id => {
    container.querySelector(`#${id}`)?.addEventListener('change', e => {
      const key = {
        'theme-select':       'theme',
        'notifications-toggle':'notifications',
        'sound-toggle':       'soundEnabled',
        'show-online-toggle': 'showOnline',
        'allow-dms-toggle':   'allowDMs',
      }[id];
      if (key) {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        settingsService.set({ [key]: value });
        if (key === 'theme') applyTheme(value);
      }
    });
  });

  container.querySelector('#save-preferences')?.addEventListener('click', () => {
    toasts.success('Preferences saved!');
  });

  // Request browser notification permission when the toggle is first enabled
  container.querySelector('#notifications-toggle')?.addEventListener('change', async e => {
    if (!e.target.checked || !('Notification' in window)) return;
    if (Notification.permission === 'granted') return; // already have permission
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      e.target.checked = false;
      settingsService.set({ notifications: false });
      toasts.warning('Notification permission denied — enable it in browser settings to receive alerts');
    } else {
      toasts.success('Notifications enabled! You\'ll be alerted when messages arrive.');
    }
  });

  // Delete channel
  container.addEventListener('click', async e => {
    const deleteBtn = e.target.closest('.delete-channel-btn');
    if (!deleteBtn) return;
    const chId = deleteBtn.dataset.channelId;
    const ok = await modals.confirm('Delete this channel? This cannot be undone.', { title: '🗑️ Delete Channel', confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await channelService.delete(chId);
      toasts.success('Channel deleted');
      deleteBtn.closest('[data-channel-id]')?.remove();
    } catch (err) {
      toasts.error(err.message);
    }
  });

  // Clear all data
  container.querySelector('#clear-data')?.addEventListener('click', async () => {
    const ok = await modals.confirm(
      'Delete ALL channels, posts, matches, settings, and identity? This cannot be undone.',
      { title: '⚠️ Clear All Data', confirmText: 'Delete Everything', danger: true }
    );
    if (!ok) return;
    localStorage.clear();
    // Also clear IndexedDB where channels, posts, matches, and identity are stored
    await new Promise(resolve => {
      const req = indexedDB.deleteDatabase('isc-storage');
      req.onsuccess = req.onerror = req.onblocked = () => resolve(undefined);
    });
    toasts.success('All data cleared. Reloading…');
    setTimeout(() => location.reload(), 1500);
  });

  // Logout
  container.querySelector('#logout-btn')?.addEventListener('click', async () => {
    const ok = await modals.confirm(
      'Clear your identity? You will get a new one on next launch.',
      { title: '🚪 Logout', confirmText: 'Logout', danger: true }
    );
    if (!ok) return;
    try {
      await identityService.clear();
      toasts.success('Logged out. Reloading…');
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      toasts.error(err.message);
    }
  });
}

export function update(container) {
  // Re-render only the channels section to reflect additions/deletions.
  // Use innerHTML on the section itself (not outerHTML) to avoid losing the element
  // reference and breaking the parent container's delegated event listeners.
  const section = container.querySelector('[data-testid="channels-section"]');
  if (!section) return;
  const channels = channelService.getAll();
  // Parse the new section HTML and replace contents
  const tmp = document.createElement('div');
  tmp.innerHTML = renderChannels(channels);
  const newSection = tmp.firstElementChild;
  if (newSection) section.replaceWith(newSection);
}
