import { UIComponent } from '../Component.js';

interface ComposeState {
  name: string;
  description: string;
  spread: number;
  error: string;
  success: boolean;
  submitting: boolean;
  networkStatus: string;
}

export class ComposeScreen extends UIComponent<any, ComposeState> {
  private networkSub: any = null;

  constructor(props: any) {
    super('div', props, {
      name: '',
      description: '',
      spread: 50,
      error: '',
      success: false,
      submitting: false,
      networkStatus: 'disconnected'
    });
    this.element.className = 'screen compose-screen';
    this.element.dataset.testid = 'compose-screen';
    this.element.style.background = '#f7f9fa';
    this.element.style.height = '100%';
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
  }

  protected onMount() {
    const { networkService } = this.props.dependencies || {};
    if (networkService) {
      this.setState({ networkStatus: networkService.getStatus ? networkService.getStatus() : 'disconnected' });
      if (networkService.on) {
        this.networkSub = networkService.on('onStatusChange', (status: string) => {
          this.setState({ networkStatus: status });
        });
      }
    }
  }

  protected onUnmount() {
    if (this.networkSub) {
      this.networkSub();
    }
  }

  protected render() {
    this.element.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #e1e8ed; background: white;">
        <button id="compose-cancel" style="padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold; background: transparent; color: #657786;" data-testid="compose-cancel">Cancel</button>
        <h1 style="font-size: 18px; font-weight: bold; margin: 0; color: #14171a;">New Channel</h1>
        <button id="compose-save" style="padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold; background: #aab8c2; color: white;" disabled data-testid="compose-save">Save</button>
      </div>

      <div style="flex: 1; padding: 20px; overflow-y: auto; max-width: 600px; margin: 0 auto; width: 100%;">
        <div id="compose-network-status" style="background: #fef3f2; border-radius: 12px; padding: 20px; margin-bottom: 16px; font-size: 14px; color: #d93025; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          ⏳ Network: disconnected
        </div>

        <div id="compose-success" style="background: #edf9ef; color: #17bf63; padding: 12px; border-radius: 8px; margin-bottom: 16px; display: none;" data-testid="channel-created">
          ✅ Channel created successfully! Redirecting...
        </div>

        <div id="compose-error" style="background: #fef3f2; color: #d93025; padding: 12px; border-radius: 8px; margin-bottom: 16px; display: none;" data-testid="compose-error">
        </div>

        <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <label style="display: block; font-size: 14px; font-weight: bold; margin-bottom: 8px; color: #14171a;">Channel Name</label>
          <input type="text" id="compose-name" placeholder="What are you thinking about?" style="width: 100%; padding: 12px; border: 1px solid #e1e8ed; border-radius: 6px; font-size: 16px; box-sizing: border-box;" maxlength="50" data-testid="compose-name-input" autocomplete="off" autocorrect="off" spellcheck="false" />
          <div id="compose-name-help" style="font-size: 12px; color: #657786; margin-top: 4px;">0/50 characters (minimum 3)</div>
        </div>

        <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <label style="display: block; font-size: 14px; font-weight: bold; margin-bottom: 8px; color: #14171a;">Description</label>
          <textarea id="compose-desc" placeholder="Describe your thoughts in detail..." style="width: 100%; padding: 12px; border: 1px solid #e1e8ed; border-radius: 6px; font-size: 16px; min-height: 120px; resize: vertical; box-sizing: border-box; font-family: inherit;" maxlength="500" data-testid="compose-description-input" autocomplete="off" autocorrect="off" spellcheck="false"></textarea>
          <div id="compose-desc-help" style="font-size: 12px; color: #657786; margin-top: 4px;">0/500 characters (minimum 10)</div>
        </div>

        <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <label style="display: block; font-size: 14px; font-weight: bold; margin-bottom: 8px; color: #14171a;">How specific are you being?</label>
          <input type="range" id="compose-spread" min="0" max="100" step="1" value="50" style="width: 100%; margin-top: 8px;" data-testid="compose-spread-slider" />
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #657786; margin-top: 4px;">
            <span>Precise (narrow matching)</span>
            <span>Exploratory (broad matching)</span>
          </div>
          <div id="compose-spread-help" style="font-size: 12px; color: #657786; margin-top: 4px;">Current: 50%</div>
        </div>

        <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <label style="display: block; font-size: 14px; font-weight: bold; margin-bottom: 8px; color: #14171a;">Add Context (optional)</label>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <button style="padding: 8px 12px; background: #f7f9fa; border: 1px solid #e1e8ed; border-radius: 16px; cursor: pointer; font-size: 14px;" type="button">📍 Location</button>
            <button style="padding: 8px 12px; background: #f7f9fa; border: 1px solid #e1e8ed; border-radius: 16px; cursor: pointer; font-size: 14px;" type="button">🕐 Time</button>
            <button style="padding: 8px 12px; background: #f7f9fa; border: 1px solid #e1e8ed; border-radius: 16px; cursor: pointer; font-size: 14px;" type="button">💭 Mood</button>
            <button style="padding: 8px 12px; background: #f7f9fa; border: 1px solid #e1e8ed; border-radius: 16px; cursor: pointer; font-size: 14px;" type="button">🔬 Domain</button>
            <button style="padding: 8px 12px; background: #f7f9fa; border: 1px solid #e1e8ed; border-radius: 16px; cursor: pointer; font-size: 14px;" type="button">⚡ Causal</button>
          </div>
          <div style="font-size: 12px; color: #657786; margin-top: 4px;">Add context to help refine semantic matching</div>
        </div>

        <div style="background: #e8f4fd; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h4 style="margin: 0 0 10px 0; color: #1da1f2; font-size: 14px;">💡 Tips for Good Channels</h4>
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #657786; line-height: 1.8;">
            <li>Use descriptive names that capture your topic</li>
            <li>Write detailed descriptions for better matching</li>
            <li>Add context to refine your semantic neighborhood</li>
            <li>Adjust specificity to control match breadth</li>
          </ul>
        </div>
      </div>
    `;

    const cancelBtn = this.element.querySelector('#compose-cancel');
    if (cancelBtn) {
       cancelBtn.addEventListener('click', () => {
           // We signal the parent/router to navigate via an event or callback
           const ev = new CustomEvent('navigate', { detail: { route: 'now' }, bubbles: true });
           this.element.dispatchEvent(ev);
       });
    }

    const saveBtn = this.element.querySelector('#compose-save');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const canSubmit = this.state.name.trim().length >= 3 && this.state.description.trim().length >= 10 && !this.state.submitting;
            if (!canSubmit) return;

            this.setState({ submitting: true, error: '' });

            try {
                const { channelService, networkService } = this.props.dependencies || {};

                if (networkService && networkService.getStatus() === 'connected') {
                    await networkService.createChannel(this.state.name.trim(), this.state.description.trim());
                } else if (channelService) {
                    await channelService.createChannel({
                        name: this.state.name.trim(),
                        description: this.state.description.trim(),
                        spread: this.state.spread,
                        relations: []
                    });
                }

                this.setState({ success: true });

                setTimeout(() => {
                   const ev = new CustomEvent('navigate', { detail: { route: 'now' }, bubbles: true });
                   this.element.dispatchEvent(ev);
                }, 1500);

            } catch (err: any) {
                console.error('[ComposeScreen] Error creating channel:', err);
                this.setState({ error: err.message || 'Failed to create channel', submitting: false });
            }
        });
    }

    const nameInput = this.element.querySelector('#compose-name');
    if (nameInput) {
        nameInput.addEventListener('input', (e) => {
            this.setState({ name: (e.target as HTMLInputElement).value });
        });
    }

    const descInput = this.element.querySelector('#compose-desc');
    if (descInput) {
        descInput.addEventListener('input', (e) => {
            this.setState({ description: (e.target as HTMLTextAreaElement).value });
        });
    }

    const spreadInput = this.element.querySelector('#compose-spread');
    if (spreadInput) {
        spreadInput.addEventListener('input', (e) => {
            this.setState({ spread: parseInt((e.target as HTMLInputElement).value, 10) });
        });
    }
  }

  protected update() {
    const netStatus = this.element.querySelector('#compose-network-status') as HTMLElement;
    if (netStatus) {
        const isConnected = this.state.networkStatus === 'connected';
        netStatus.style.background = isConnected ? '#edf9ef' : '#fef3f2';
        netStatus.style.color = isConnected ? '#17bf63' : '#d93025';
        netStatus.innerHTML = isConnected ? '✅ Network connected' : `⏳ Network: ${this.state.networkStatus}`;
    }

    const nameHelp = this.element.querySelector('#compose-name-help') as HTMLElement;
    if (nameHelp) nameHelp.textContent = `${this.state.name.length}/50 characters (minimum 3)`;

    const descHelp = this.element.querySelector('#compose-desc-help') as HTMLElement;
    if (descHelp) descHelp.textContent = `${this.state.description.length}/500 characters (minimum 10)`;

    const spreadHelp = this.element.querySelector('#compose-spread-help') as HTMLElement;
    if (spreadHelp) spreadHelp.textContent = `Current: ${this.state.spread}%`;

    const canSubmit = this.state.name.trim().length >= 3 && this.state.description.trim().length >= 10 && !this.state.submitting;
    const saveBtn = this.element.querySelector('#compose-save') as HTMLButtonElement;
    if (saveBtn) {
        saveBtn.disabled = !canSubmit;
        saveBtn.style.background = canSubmit ? '#1da1f2' : '#aab8c2';
        saveBtn.textContent = this.state.submitting ? 'Creating...' : 'Save';
    }

    const successEl = this.element.querySelector('#compose-success') as HTMLElement;
    if (successEl) {
        successEl.style.display = this.state.success ? 'block' : 'none';
    }

    const errEl = this.element.querySelector('#compose-error') as HTMLElement;
    if (errEl) {
        errEl.style.display = this.state.error ? 'block' : 'none';
        errEl.textContent = `⚠️ ${this.state.error}`;
    }
  }
}
