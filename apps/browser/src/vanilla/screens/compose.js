/**
 * Compose Screen — Create a new channel (your thought fingerprint)
 * A channel is a named semantic description of what you're thinking about.
 * ISC embeds it locally and uses it to find peers with similar mental models.
 */

import { channelService } from '../../services/index.js';
import { networkService } from '../../services/network.js';
import { escapeHtml } from '../../utils/dom.js';
import { toasts } from '../../utils/toast.js';

// Relational context tags — correspond to ISC's compositional embedding relations
const CONTEXT_TAGS = [
  { key: 'location',  label: '📍 Location',  hint: 'Where this is relevant (city, region, virtual space)' },
  { key: 'time',      label: '🕐 Time',       hint: 'When — a period, event, or season' },
  { key: 'mood',      label: '💭 Mood',       hint: 'Emotional tone or mental state' },
  { key: 'domain',    label: '🔬 Domain',     hint: 'Field or discipline (science, art, code…)' },
  { key: 'causal',    label: '⚡ Causal',     hint: 'A cause→effect relationship in your thoughts' },
];

export function render() {
  const netStatus = networkService.getStatus();
  const connected = netStatus?.connected ?? false;

  return `
    <div class="screen compose-screen" data-testid="compose-screen">
      <div class="screen-header" data-testid="compose-header">
        <button class="btn btn-ghost btn-sm" id="compose-cancel" data-testid="compose-cancel" aria-label="Cancel">← Cancel</button>
        <h1 class="screen-title">✏️ New Channel</h1>
        <button class="btn btn-primary btn-sm" id="compose-save" data-testid="compose-save" disabled aria-label="Save channel">Save</button>
      </div>

      <div class="screen-body" data-testid="compose-body">
        <div class="info-banner ${connected ? 'sync' : 'warning'} mb-4" data-testid="compose-network-status">
          ${connected
            ? '✅ Online — your vector will be announced to the P2P network'
            : `○ ${escapeHtml(netStatus?.status ?? 'Offline')} — channel saved locally, will sync on reconnect`}
        </div>

        <div id="compose-error" class="info-banner error mb-4" style="display:none" data-testid="compose-error" role="alert"></div>
        <div id="compose-success" class="info-banner sync mb-4" style="display:none" data-testid="channel-created">
          ✅ Channel created! Generating your semantic vector…
        </div>

        <div class="card" data-testid="compose-name-card">
          <div class="card-title">💬 Channel Name</div>
          <input type="text" id="compose-name" class="form-input"
                 placeholder="What are you thinking about?"
                 name="name" maxlength="50" autocomplete="off" spellcheck="true"
                 data-testid="compose-name-input" aria-label="Channel name" aria-required="true" />
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
            <span class="form-hint">Give your thought a name (3–50 characters)</span>
            <span class="form-count" id="name-count">0 / 50</span>
          </div>
        </div>

        <div class="card">
          <div class="card-title">📝 Description</div>
          <div class="form-hint mb-2">
            Be specific — the more detail you provide, the better the semantic matching.
            Your text is embedded <strong>locally</strong> and never sent to any server.
          </div>
          <textarea id="compose-description" class="form-textarea"
                    placeholder="Describe what you're thinking about in detail — your perspective, questions, ideas. Use your own words."
                    name="description" maxlength="500" autocomplete="off" rows="5"
                    data-testid="compose-description-input" aria-label="Channel description" aria-required="true"></textarea>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
            <span class="form-hint">Minimum 10 characters for meaningful matching</span>
            <span class="form-count" id="desc-count">0 / 500</span>
          </div>
        </div>

        <div class="card">
          <div class="card-title">🎯 Match Specificity</div>
          <div class="form-hint mb-2">
            How broad should your semantic neighborhood be?
          </div>
          <input type="range" id="compose-spread" class="form-range"
                 min="0" max="100" value="30"
                 data-testid="compose-spread-slider" aria-label="Match specificity" />
          <div class="spread-labels">
            <div class="spread-label-row">
              <span>🎯 Precise</span>
              <span class="spread-value" id="spread-value">30%</span>
              <span>🌊 Exploratory</span>
            </div>
            <div class="spread-desc" id="spread-desc">Near-exact matches only — finds people with very similar language</div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">
            🔗 Relational Context
            <span class="card-title-note">(optional — deepens matching)</span>
          </div>
          <div class="context-grid" id="context-options">
            ${CONTEXT_TAGS.map(tag => `
              <button type="button" class="context-tag" data-key="${tag.key}"
                      title="${escapeHtml(tag.hint)}" aria-pressed="false">
                ${escapeHtml(tag.label)}
              </button>
            `).join('')}
          </div>
          <div id="context-input-area"></div>
          <p class="form-hint mt-2">
            Context creates compositional embeddings — e.g., "AI ethics <strong>in Tokyo</strong>" finds different peers than "AI ethics <strong>globally</strong>".
          </p>
        </div>

        <div class="card card-blue">
          <div class="card-title" style="color:var(--c-brand)">💡 Tips for Better Matching</div>
          <ul class="tips-list">
            <li>Write in complete sentences — LLMs understand grammar and nuance</li>
            <li>Include your perspective, not just the topic</li>
            <li>Specificity wins: "WebAssembly SIMD optimization" beats just "WebAssembly"</li>
            <li>Your words don't have to match other people's words — that's the point</li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

const SPREAD_DESCS = [
  [0,  15,  'Near-exact matches — people using very similar language'],
  [15, 35,  'Close matches — overlapping ideas and vocabulary'],
  [35, 55,  'Balanced — good mix of precision and discovery'],
  [55, 75,  'Broader matches — adjacent topics and related ideas'],
  [75, 100, 'Exploratory — serendipitous connections across domains'],
];

function spreadDesc(v) {
  return SPREAD_DESCS.find(([lo, hi]) => v >= lo && v <= hi)?.[2] ?? '';
}

export function bind(container) {
  const nameInput  = container.querySelector('#compose-name');
  const descInput  = container.querySelector('#compose-description');
  const spreadInput = container.querySelector('#compose-spread');
  const saveBtn    = container.querySelector('#compose-save');
  const cancelBtn  = container.querySelector('#compose-cancel');
  const nameCount  = container.querySelector('#name-count');
  const descCount  = container.querySelector('#desc-count');
  const spreadVal  = container.querySelector('#spread-value');
  const spreadDescEl = container.querySelector('#spread-desc');
  const errorDiv   = container.querySelector('#compose-error');
  const successDiv = container.querySelector('#compose-success');

  const validate = () => {
    const nameOk = (nameInput?.value.trim().length ?? 0) >= 3;
    const descOk = (descInput?.value.trim().length ?? 0) >= 10;
    if (saveBtn) saveBtn.disabled = !(nameOk && descOk);
  };

  nameInput?.addEventListener('input', e => {
    if (nameCount) nameCount.textContent = `${e.target.value.length} / 50`;
    validate();
  });

  descInput?.addEventListener('input', e => {
    if (descCount) descCount.textContent = `${e.target.value.length} / 500`;
    validate();
  });

  spreadInput?.addEventListener('input', e => {
    const v = parseInt(e.target.value, 10);
    if (spreadVal) spreadVal.textContent = `${v}%`;
    if (spreadDescEl) spreadDescEl.textContent = spreadDesc(v);
  });
  // Set initial spread description
  if (spreadDescEl) spreadDescEl.textContent = spreadDesc(parseInt(spreadInput?.value ?? '30', 10));

  // Context tag toggles with inline input
  const contextInputArea = container.querySelector('#context-input-area');
  container.querySelector('#context-options')?.addEventListener('click', e => {
    const btn = e.target.closest('.context-tag');
    if (!btn) return;
    const active = btn.getAttribute('aria-pressed') === 'true';
    btn.setAttribute('aria-pressed', active ? 'false' : 'true');
    btn.classList.toggle('selected', !active);
    renderContextInputs(container, contextInputArea);
  });

  cancelBtn?.addEventListener('click', () => { window.location.hash = '#/now'; });

  saveBtn?.addEventListener('click', async () => {
    const name   = nameInput?.value.trim();
    const desc   = descInput?.value.trim();
    const spread = parseFloat(spreadInput?.value ?? '30') / 100;
    if (!name || !desc) return;

    // Collect context tags
    const selectedTags = [...container.querySelectorAll('.context-tag[aria-pressed="true"]')]
      .map(btn => ({
        key:   btn.dataset.key,
        value: container.querySelector(`#ctx-input-${btn.dataset.key}`)?.value.trim() || '',
      }))
      .filter(t => t.value);

    if (errorDiv) errorDiv.style.display = 'none';
    saveBtn.disabled = true;
    saveBtn.textContent = '…';

    try {
      await channelService.create(name, desc, spread);
      toasts.success(`Channel "#${name}" created!`);
      if (successDiv) successDiv.style.display = 'flex';
      setTimeout(() => { window.location.hash = '#/now'; }, 1200);
    } catch (err) {
      const msg = err.message || 'Failed to create channel';
      if (errorDiv) { errorDiv.textContent = `⚠️ ${msg}`; errorDiv.style.display = 'flex'; }
      toasts.error(msg);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  });

  // Ctrl+Enter shortcut
  container.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !saveBtn?.disabled) saveBtn?.click();
  });

  setTimeout(() => nameInput?.focus(), 50);
}

function renderContextInputs(container, area) {
  if (!area) return;
  const selected = [...container.querySelectorAll('.context-tag[aria-pressed="true"]')];
  if (!selected.length) { area.innerHTML = ''; return; }

  const PLACEHOLDERS = {
    location: 'e.g. Tokyo, online, Pacific Northwest',
    time:     'e.g. summer 2026, this quarter',
    mood:     'e.g. curious and focused, anxious',
    domain:   'e.g. machine learning, classical music',
    causal:   'e.g. automation → job displacement',
  };

  area.innerHTML = `
    <div class="context-inputs mt-3">
      ${selected.map(btn => {
        const key   = btn.dataset.key;
        const label = btn.textContent.trim();
        const existing = area.querySelector(`#ctx-input-${key}`)?.value || '';
        return `
          <div class="context-input-row">
            <label class="context-input-label" for="ctx-input-${key}">${label}</label>
            <input type="text" id="ctx-input-${key}" class="form-input context-input-field"
                   placeholder="${escapeHtml(PLACEHOLDERS[key] || '')}"
                   value="${escapeHtml(existing)}" autocomplete="off" />
          </div>
        `;
      }).join('')}
    </div>
  `;
}
