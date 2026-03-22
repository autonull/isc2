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
import { escapeHtml } from '../../utils/dom.js';
import { toasts } from '../../utils/toast.js';
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
  <h2 class="modal-title" data-testid="channel-edit-title">${isEdit ? 'Edit Channel' : 'New Channel'}</h2>
</div>
<div class="modal-body" data-testid="channel-edit-body">
  <div id="channel-edit-error" class="info-banner error mb-3 hidden" role="alert"></div>

  <div class="form-group">
    <label class="form-label" for="channel-edit-name">Channel Name</label>
    <input type="text" id="channel-edit-name" class="form-input"
           placeholder="Give your thought a name"
           maxlength="50" autocomplete="off"
           data-testid="channel-edit-name"
           value="${escapeHtml(channel?.name ?? '')}" />
    <div class="form-hint">3–50 characters</div>
  </div>

  <div class="form-group">
    <label class="form-label" for="channel-edit-description">Description</label>
    <textarea id="channel-edit-description" class="form-textarea"
              placeholder="What are you thinking about right now? Be specific — this is your semantic fingerprint."
              maxlength="500" rows="4"
              data-testid="channel-edit-description">${escapeHtml(channel?.description ?? '')}</textarea>
    <div class="form-hint">
      This is what gets embedded. Your text is processed locally — nothing leaves your device.
    </div>
  </div>

  <div class="form-group">
    <label class="form-label">Neighborhood breadth</label>
    <div class="breadth-control" data-testid="breadth-control">
      <button type="button" class="breadth-btn${!channel?.breadth || channel?.breadth === 'narrow' ? ' active' : ''}" data-breadth="narrow">
        Narrow
      </button>
      <button type="button" class="breadth-btn${channel?.breadth === 'balanced' ? ' active' : ' active'}" data-breadth="balanced">
        Balanced
      </button>
      <button type="button" class="breadth-btn${channel?.breadth === 'broad' ? ' active' : ''}" data-breadth="broad">
        Broad
      </button>
    </div>
    <div class="form-hint" id="breadth-hint">Narrow finds closer matches; Broad casts wider into thought-space.</div>
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

  let selectedBreadth = channel?.breadth ?? 'balanced';

  // Initialize the correct breadth button
  breadthBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.breadth === selectedBreadth);
    btn.addEventListener('click', () => {
      selectedBreadth = btn.dataset.breadth;
      breadthBtns.forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  function validate() {
    const name = nameInput.value.trim();
    const desc = descInput.value.trim();
    saveBtn.disabled = name.length < 3 || desc.length < 10;
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
    if (description.length < 10) {
      showError(errorEl, 'Description must be at least 10 characters for meaningful matching.');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = isEdit ? 'Updating…' : 'Creating…';
    errorEl.classList.add('hidden');

    try {
      let savedChannel;
      if (isEdit) {
        // updateChannel handles unsubscribe old → recompute → subscribe new (Phase 2.4)
        savedChannel = await networkService.updateChannel(channel.id, { name, description });
        actions.setChannels(networkService.getChannels());
        toasts.success('Channel updated');
      } else {
        savedChannel = await networkService.createChannel(name, description);
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
