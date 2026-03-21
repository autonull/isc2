/**
 * ISC Vanilla JS Entry Point
 *
 * Minimal bootstrap: import styles, create the App, start it.
 * All services (network, state, logger) are shared with the Preact implementation.
 * See src/index.tsx for the Preact version.
 */

import '../styles/main.css';
import './styles/irc.css';

import { createApp } from './app.js';

const container = document.getElementById('app');

if (!container) {
  console.error('[ISC] #app container not found');
} else {
  createApp(container).start().catch(err => {
    console.error('[ISC] Fatal startup error:', err);
    container.innerHTML = `
      <div class="fatal-error-screen">
        <div class="fatal-error-logo">ISC</div>
        <div class="fatal-error-title">Fatal Error</div>
        <pre class="fatal-error-message">${
          err instanceof Error ? err.message : String(err)
        }</pre>
        <button class="fatal-error-retry" onclick="location.reload()">Retry</button>
      </div>
    `;
  });
}
