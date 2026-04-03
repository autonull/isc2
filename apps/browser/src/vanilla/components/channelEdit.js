/**
 * ChannelEdit Modal Component
 *
 * Replaces compose.js screen. A modal for creating or editing channels.
 * Two call sites: create (no channel arg) and edit (channel arg pre-fills form).
 *
 * On save:
 * 1. Embed the description (async — shows spinner)
 * 2. If editing: unsubscribe old channel bucket topics
 * 3. Announce to DHT under new LSH keys
 * 4. Subscribe to new gossipsub bucket topics
 * 5. Close modal, update sidebar, navigate to /channel
 */

import { channelService } from '../../services/index.js';
import { networkService } from '../../services/network.ts';
import { escapeHtml } from '../utils/dom.js';
import { toast as toasts } from '../../utils/toast.ts';
import { modals } from './modal.js';
import { getState, actions } from '../../state.js';

/**
 * Open the ChannelEdit modal.
 * @param {Object|null} channel - Existing channel to edit, or null/undefined to create new.
 */
export function openChannelEdit(channel = null) {
  const isEdit = !!channel;

  const html = `
<div class="modal-header">
  <h2 class="modal-title" data-testid="channel-edit-title">${isEdit ? 'Edit Channel' : 'What are you thinking about?'}</h2>
</div>
<div class="modal-body" data-testid="channel-edit-body">
  <div id="channel-edit-error" class="info-banner error mb-3 hidden" role="alert"></div>

  <div class="form-group">
    <label class="form-label" for="channel-edit-name">Give it a name</label>
    <input type="text" id="channel-edit-name" class="form-input"
           placeholder="Name your thought or topic"
           maxlength="50" autocomplete="off"
           data-testid="channel-edit-name"
           value="${escapeHtml(channel?.name ?? '')}" />
    <div class="form-hint">3–50 characters</div>
  </div>

  <div class="form-group">
    <label class="form-label" for="channel-edit-description">Description (optional)</label>
    <textarea id="channel-edit-description" class="form-textarea"
              placeholder="Optional. The more you say, the more precisely you'll be matched."
              maxlength="500" rows="4"
              data-testid="channel-edit-description">${escapeHtml(channel?.description ?? '')}</textarea>
    <div class="form-hint">
      If left blank, your channel name is used as the semantic fingerprint. Processed locally — nothing leaves your device.
    </div>
  </div>

  <div class="form-group">
    <label class="form-label">Neighborhood breadth</label>
    <div class="breadth-control" data-testid="breadth-control">
      <button type="button" class="breadth-btn${channel?.breadth === 'narrow' ? ' active' : ''}" data-breadth="narrow">
        Narrow
      </button>
      <button type="button" class="breadth-btn${!channel?.breadth || channel?.breadth === 'balanced' ? ' active' : ''}" data-breadth="balanced">
        Balanced
      </button>
      <button type="button" class="breadth-btn${channel?.breadth === 'broad' ? ' active' : ''}" data-breadth="broad">
        Broad
      </button>
    </div>
    <div class="form-hint" id="breadth-hint">Narrow finds closer matches; Broad casts wider into thought-space.</div>
  </div>

  <div class="form-group">
    <label class="form-label">Context Relations (optional)</label>
    <div class="form-hint">Add up to 5 relation tags to refine your semantic position.</div>
    <div id="relations-list" class="relations-list" data-testid="relations-list"></div>
    <button type="button" id="add-relation-btn" class="btn btn-sm btn-ghost" data-testid="add-relation-btn">
      + Add context
    </button>
  </div>
</div>
<div class="modal-actions">
  <button class="btn btn-ghost" id="channel-edit-cancel" data-testid="channel-edit-cancel">Cancel</button>
  <button class="btn btn-primary" id="channel-edit-save" data-testid="channel-edit-save" disabled>
    ${isEdit ? 'Update Channel' : 'Create Channel'}
  </button>
</div>
`;

  const overlay = modals.open(html);

  const nameInput = overlay.querySelector('#channel-edit-name');
  const descInput = overlay.querySelector('#channel-edit-description');
  const saveBtn = overlay.querySelector('#channel-edit-save');
  const cancelBtn = overlay.querySelector('#channel-edit-cancel');
  const errorEl = overlay.querySelector('#channel-edit-error');
  const breadthBtns = overlay.querySelectorAll('.breadth-btn');
  const relationsList = overlay.querySelector('#relations-list');
  const addRelationBtn = overlay.querySelector('#add-relation-btn');

  let selectedBreadth = channel?.breadth ?? 'balanced';
  let relations = (channel?.relations ?? []).slice();

  // Initialize the correct breadth button
  breadthBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.breadth === selectedBreadth);
    btn.addEventListener('click', () => {
      selectedBreadth = btn.dataset.breadth;
      breadthBtns.forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  // Relation tag constants
  const RELATION_TAGS = [
    'in_location',
    'during_time',
    'with_mood',
    'under_domain',
    'causes_effect',
    'part_of',
    'similar_to',
    'opposed_to',
    'requires',
    'boosted_by',
  ];

  const RELATION_PLACEHOLDERS = {
    in_location: 'lat:35.69, long:139.69, radius:50km',
    during_time: 'start:2026-01-01, end:2026-12-31',
    with_mood: 'describe a mood or emotional state',
    under_domain: 'e.g., art, science, business',
    causes_effect: 'describe an effect or consequence',
    part_of: 'describe what this is part of',
    similar_to: 'describe similar topics',
    opposed_to: 'describe opposing perspectives',
    requires: 'describe prerequisites or requirements',
    boosted_by: 'describe what strengthens this',
  };

  function renderRelations() {
    relationsList.innerHTML = '';
    relations.forEach((rel, idx) => {
      const row = document.createElement('div');
      row.className = 'relation-row';
      row.innerHTML = `
        <select class="relation-tag-select" data-idx="${idx}" data-testid="relation-tag-${idx}">
          <option value="">Select tag…</option>
          ${RELATION_TAGS.map(tag => `<option value="${tag}" ${rel.tag === tag ? 'selected' : ''}>${tag}</option>`).join('')}
        </select>
        <input type="text" class="relation-object-input" data-idx="${idx}"
               placeholder="${RELATION_PLACEHOLDERS[rel.tag] || 'Enter value'}"
               value="${escapeHtml(rel.object || '')}" maxlength="100"
               data-testid="relation-object-${idx}" />
        <button type="button" class="btn btn-sm btn-ghost relation-remove-btn" data-idx="${idx}"
                data-testid="relation-remove-${idx}" title="Remove">✕</button>
      `;
      relationsList.appendChild(row);
    });

    // Bind select and input events
    overlay.querySelectorAll('.relation-tag-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        relations[idx].tag = e.target.value;
        // Update placeholder when tag changes
        const input = overlay.querySelector(`.relation-object-input[data-idx="${idx}"]`);
        if (input) {
          input.placeholder = RELATION_PLACEHOLDERS[e.target.value] || 'Enter value';
        }
      });
    });

    overlay.querySelectorAll('.relation-object-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        relations[idx].object = e.target.value;
      });
    });

    overlay.querySelectorAll('.relation-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = parseInt(e.target.dataset.idx, 10);
        relations.splice(idx, 1);
        renderRelations();
      });
    });

    // Update add button state
    addRelationBtn.disabled = relations.length >= 5;
  }

  addRelationBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (relations.length < 5) {
      relations.push({ tag: '', object: '' });
      renderRelations();
      // Focus the new tag select
      const newSelect = relationsList.querySelector('.relation-tag-select:last-child');
      newSelect?.focus();
    }
  });

  renderRelations();

  function validate() {
    const name = nameInput.value.trim();
    saveBtn.disabled = name.length < 3;
  }

  nameInput.addEventListener('input', validate);
  descInput.addEventListener('input', validate);
  validate();

  cancelBtn.addEventListener('click', () => modals.close());

  saveBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    const description = descInput.value.trim();

    if (name.length < 3) {
      showError(errorEl, 'Channel name must be at least 3 characters.');
      return;
    }

    // Filter out relations with missing tags or objects
    const validRelations = relations.filter(r => r.tag && r.object);

    saveBtn.disabled = true;
    saveBtn.textContent = isEdit ? 'Updating…' : 'Creating…';
    errorEl.classList.add('hidden');

    try {
      let savedChannel;
      if (isEdit) {
        savedChannel = await networkService.updateChannel(channel.id, { name, description, relations: validRelations });
        actions.setChannels(networkService.getChannels());
        toasts.success('Channel updated');
      } else {
        savedChannel = await networkService.createChannel(name, description, { spread: 'balanced', relations: validRelations });
        actions.setChannels(networkService.getChannels());
        actions.setActiveChannel(savedChannel.id);
        toasts.success('Channel created');
        document.dispatchEvent(new CustomEvent('isc:channel-created', { detail: { channel: savedChannel } }));
      }

      modals.close();
      window.location.hash = '#/channel';
    } catch (err) {
      showError(errorEl, err.message || 'Failed to save channel');
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? 'Update Channel' : 'Create Channel';
    }
  });

  // Focus the name input
  requestAnimationFrame(() => nameInput.focus());
}

function showError(el, message) {
  el.textContent = message;
  el.classList.remove('hidden');
}
