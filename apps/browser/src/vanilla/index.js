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
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#1a1d26;color:#e05353;font-family:monospace;flex-direction:column;gap:16px">
        <div style="font-size:32px;font-weight:800;color:#4a90d9">ISC</div>
        <div style="font-size:14px">Fatal Error</div>
        <pre style="background:#0d0f13;padding:16px;border-radius:6px;max-width:600px;overflow:auto;font-size:12px;color:#d8dce6">${
          err instanceof Error ? err.message : String(err)
        }</pre>
        <button onclick="location.reload()"
                style="padding:10px 20px;background:#4a90d9;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px">
          Retry
        </button>
      </div>
    `;
  });
}
