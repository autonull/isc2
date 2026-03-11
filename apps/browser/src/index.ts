import { initializeIdentity } from './identity/index.js';

async function main() {
  console.log('ISC Browser App starting...');

  const identity = await initializeIdentity();

  if (identity.isInitialized) {
    console.log('Identity initialized:', identity.publicKeyFingerprint);
    updateUI(identity.publicKeyFingerprint);
  } else {
    console.log('No identity found, generating new one...');
    const newIdentity = await initializeIdentity();
    console.log('New identity created:', newIdentity.publicKeyFingerprint);
    updateUI(newIdentity.publicKeyFingerprint);
  }
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
