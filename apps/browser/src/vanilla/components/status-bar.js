/**
 * Status Bar Component
 * Fixed bottom bar showing connection status, peer/channel counts, and last log entry
 */

export function createStatusBar(container, { onToggleDebug }) {
  const el = document.createElement('div');
  el.className = 'status-bar';
  el.setAttribute('data-testid', 'status-bar');
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');

  el.innerHTML = `
    <div class="status-bar-section" data-testid="status-connection">
      <span class="status-dot connecting" data-field="status-dot"></span>
      <span class="status-text connecting" data-field="status-text">Connecting...</span>
    </div>
    <div class="status-bar-section" data-testid="status-peers">
      <span>peers: </span><span data-field="peer-count">0</span>
    </div>
    <div class="status-bar-section" data-testid="status-channels">
      <span>ch: </span><span data-field="channel-count">0</span>
    </div>
    <div class="status-bar-log" data-testid="status-log" data-field="log-text">Ready</div>
    <button class="debug-toggle-btn" data-testid="debug-toggle" title="Toggle debug panel (Ctrl+D)">DEBUG</button>
  `;

  container.appendChild(el);

  el.querySelector('[data-testid="debug-toggle"]')?.addEventListener('click', () => onToggleDebug?.());

  const fields = {
    dot:     el.querySelector('[data-field="status-dot"]'),
    text:    el.querySelector('[data-field="status-text"]'),
    peers:   el.querySelector('[data-field="peer-count"]'),
    channels:el.querySelector('[data-field="channel-count"]'),
    log:     el.querySelector('[data-field="log-text"]'),
  };

  return {
    update({ status, peerCount = 0, channelCount = 0 }) {
      const cls = { connected: 'online', connecting: 'connecting', disconnected: 'offline', error: 'offline' }[status] ?? 'offline';
      const label = { connected: 'Online', connecting: 'Connecting...', disconnected: 'Offline', error: 'Error' }[status] ?? 'Offline';

      if (fields.dot)      { fields.dot.className = `status-dot ${cls}`; }
      if (fields.text)     { fields.text.className = `status-text ${cls}`; fields.text.textContent = label; }
      if (fields.peers)    fields.peers.textContent = String(peerCount);
      if (fields.channels) fields.channels.textContent = String(channelCount);
    },

    setLog(message) {
      if (fields.log) fields.log.textContent = message;
    },

    destroy() { el.remove(); },
  };
}
