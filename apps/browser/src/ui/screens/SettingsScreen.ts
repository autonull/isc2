import { UIComponent } from '../Component.js';

interface SettingsState {
  name: string;
  bio: string;
  fingerprint: string;
}

export class SettingsScreen extends UIComponent<any, SettingsState> {
  constructor(props: any) {
    super('div', props, { name: '', bio: '', fingerprint: '' });
    this.element.className = 'screen settings-screen';
  }

  protected async onMount() {
    const { settings, identity } = this.props.dependencies || {};
    try {
      const data = settings ? await settings.loadSettings() : {};
      const fp = identity ? identity.publicKeyFingerprint : 'Unknown';
      this.setState({ name: data?.name || '', bio: data?.bio || '', fingerprint: fp || 'Unknown' });
    } catch (e) {
      console.warn('Failed to load settings', e);
    }
  }

  protected render() {
    this.element.innerHTML = `
      <div class="channel-header">
        <h2>⚙ Settings</h2>
        <p>Manage your identity and preferences.</p>
      </div>
      <div class="settings-form">
        <p><strong>Identity Fingerprint:</strong> <span id="setting-fp" style="font-family: monospace;"></span></p>
        <label>Display Name: <input type="text" id="setting-name" /></label><br/><br/>
        <label>Bio: <textarea id="setting-bio"></textarea></label><br/><br/>
        <button id="save-settings">Save Settings</button>
        <p id="save-status" style="color: green; display: none;">Saved!</p>
      </div>
    `;

    const btn = this.element.querySelector('#save-settings');
    btn?.addEventListener('click', async () => {
      const name = (this.element.querySelector('#setting-name') as HTMLInputElement).value;
      const bio = (this.element.querySelector('#setting-bio') as HTMLTextAreaElement).value;

      const { settings } = this.props.dependencies || {};
      if (settings) {
        await settings.saveSettings({ name, bio });
        const status = this.element.querySelector('#save-status') as HTMLElement;
        status.style.display = 'block';
        setTimeout(() => status.style.display = 'none', 2000);
      }
    });
  }

  protected update() {
    (this.element.querySelector('#setting-name') as HTMLInputElement).value = this.state.name;
    (this.element.querySelector('#setting-bio') as HTMLTextAreaElement).value = this.state.bio;
    (this.element.querySelector('#setting-fp') as HTMLElement).innerText = this.state.fingerprint;
  }
}
