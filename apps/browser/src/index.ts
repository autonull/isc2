import { initializeIdentity } from './identity/index.js';

async function main() {
  console.log('ISC Browser App starting...');

  const identity = await initializeIdentity();
  const fingerprint = identity.isInitialized ? identity.publicKeyFingerprint : (await initializeIdentity()).publicKeyFingerprint;

  console.log(`Identity initialized: ${fingerprint}`);
  updateUI(fingerprint);
}

function updateUI(fingerprint: string | null) {
  const app = document.getElementById('app');
  if (app && fingerprint) {
    app.innerHTML = `
      <h1>ISC - Indexed Semantic Connect</h1>
      <div class="identity">
        <h2>Your Identity</h2>
        <p class="fingerprint">${fingerprint}</p>
      </div>
      <div class="channels">
        <h2>Channels</h2>
        <p>No active channels</p>
      </div>
    `;
  }
}

document.addEventListener('DOMContentLoaded', main);
