import { UIComponent } from '../Component.js';

interface SettingsState {
  name: string;
  bio: string;
  fingerprint: string;
  autoDiscover: boolean;
  discoverInterval: number;
  similarityThreshold: number;
  theme: string;
  notifications: boolean;
}

export class SettingsScreen extends UIComponent<any, SettingsState> {
  constructor(props: any) {
    super('div', props, {
      name: '', bio: '', fingerprint: '',
      autoDiscover: true, discoverInterval: 30, similarityThreshold: 40, theme: 'dark', notifications: true
    });
    this.element.className = 'screen settings-screen';
  }

  protected async onMount() {
    const { settings, identity } = this.props.dependencies || {};
    try {
      const data = settings ? await settings.loadSettings() : {};
      const fp = identity ? identity.publicKeyFingerprint : 'Unknown';
      this.setState({ name: data?.name || '', bio: data?.bio || '', fingerprint: fp || 'Unknown' });

      const savedPrefs = localStorage.getItem('isc-settings');
      if (savedPrefs) {
        const prefs = JSON.parse(savedPrefs);
        this.setState({
           autoDiscover: prefs.autoDiscover ?? true,
           discoverInterval: prefs.discoverInterval ?? 30,
           similarityThreshold: prefs.similarityThreshold ?? 40,
           theme: prefs.theme ?? 'dark',
           notifications: prefs.notifications ?? true
        });
      }
    } catch (e) {
      console.warn('Failed to load settings', e);
    }
  }

  protected render() {
    this.element.innerHTML = `
      <div class="channel-header" style="padding: 16px 20px; border-bottom: 1px solid #e1e8ed; background: white;">
        <h2 style="font-size: 20px; font-weight: bold; margin: 0; color: #14171a;">⚙ Settings</h2>
        <p style="font-size: 14px; color: #657786; margin: 4px 0 0 0;">Manage your identity and preferences.</p>
      </div>
      <div style="padding: 20px; max-width: 800px; margin: 0 auto;">

        <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h3 style="font-size: 16px; font-weight: bold; margin: 0 0 16px 0;">👤 Profile</h3>
          <p style="font-size: 14px; color: #657786; margin-bottom: 16px;"><strong>Fingerprint:</strong> <span id="setting-fp" style="font-family: monospace; background: #f7f9fa; padding: 4px 8px; border-radius: 4px; font-size: 12px;"></span></p>

          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 14px; font-weight: bold; margin-bottom: 6px;">Display Name</label>
            <input type="text" id="setting-name" style="width: 100%; padding: 10px; border: 1px solid #e1e8ed; border-radius: 6px; box-sizing: border-box;" />
          </div>

          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 14px; font-weight: bold; margin-bottom: 6px;">Bio</label>
            <textarea id="setting-bio" style="width: 100%; padding: 10px; border: 1px solid #e1e8ed; border-radius: 6px; min-height: 80px; box-sizing: border-box;"></textarea>
          </div>

          <button id="save-profile" style="padding: 10px 20px; background: #1da1f2; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Save Profile</button>
          <span id="save-status" style="color: #17bf63; font-size: 14px; margin-left: 12px; display: none;">Saved!</span>
        </div>

        <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h3 style="font-size: 16px; font-weight: bold; margin: 0 0 16px 0;">⚙️ Preferences</h3>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div>
              <label style="font-size: 14px; font-weight: bold; display: block;">Auto-Discover</label>
              <span style="font-size: 12px; color: #657786;">Periodically search for new peers</span>
            </div>
            <input type="checkbox" id="pref-auto-discover" style="width: 20px; height: 20px;" />
          </div>

          <div style="margin-bottom: 16px;">
            <label style="font-size: 14px; font-weight: bold; display: block; margin-bottom: 6px;">Discover Interval (seconds)</label>
            <input type="number" id="pref-interval" style="padding: 8px; border: 1px solid #e1e8ed; border-radius: 6px;" min="10" max="300" />
          </div>

          <div style="margin-bottom: 16px;">
            <label style="font-size: 14px; font-weight: bold; display: block; margin-bottom: 6px;">Similarity Threshold (%)</label>
            <input type="range" id="pref-similarity" min="1" max="100" style="width: 100%;" />
            <div style="text-align: right; font-size: 12px; color: #657786;"><span id="pref-similarity-val"></span>%</div>
          </div>

          <div style="margin-bottom: 16px;">
            <label style="font-size: 14px; font-weight: bold; display: block; margin-bottom: 6px;">Theme</label>
            <select id="pref-theme" style="padding: 8px; border: 1px solid #e1e8ed; border-radius: 6px; width: 100%;">
              <option value="system">System Default</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div>
              <label style="font-size: 14px; font-weight: bold; display: block;">Notifications</label>
              <span style="font-size: 12px; color: #657786;">Enable push notifications</span>
            </div>
            <input type="checkbox" id="pref-notifications" style="width: 20px; height: 20px;" />
          </div>

          <button id="save-prefs" style="padding: 10px 20px; background: #e8f4fd; color: #1da1f2; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Save Preferences</button>
          <span id="prefs-status" style="color: #17bf63; font-size: 14px; margin-left: 12px; display: none;">Saved!</span>
        </div>
      </div>
    `;

    const profileBtn = this.element.querySelector('#save-profile');
    profileBtn?.addEventListener('click', async () => {
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

    const prefsBtn = this.element.querySelector('#save-prefs');
    prefsBtn?.addEventListener('click', () => {
       const autoDiscover = (this.element.querySelector('#pref-auto-discover') as HTMLInputElement).checked;
       const discoverInterval = parseInt((this.element.querySelector('#pref-interval') as HTMLInputElement).value, 10);
       const similarityThreshold = parseInt((this.element.querySelector('#pref-similarity') as HTMLInputElement).value, 10);
       const theme = (this.element.querySelector('#pref-theme') as HTMLSelectElement).value;
       const notifications = (this.element.querySelector('#pref-notifications') as HTMLInputElement).checked;

       this.setState({ autoDiscover, discoverInterval, similarityThreshold, theme, notifications });

       localStorage.setItem('isc-settings', JSON.stringify({
         autoDiscover, discoverInterval, similarityThreshold, theme, notifications
       }));

       const status = this.element.querySelector('#prefs-status') as HTMLElement;
       status.style.display = 'inline-block';
       setTimeout(() => status.style.display = 'none', 2000);
    });

    // Live update for range slider
    const simSlider = this.element.querySelector('#pref-similarity') as HTMLInputElement;
    const simVal = this.element.querySelector('#pref-similarity-val');
    if (simSlider && simVal) {
        simSlider.addEventListener('input', (e) => {
            simVal.textContent = (e.target as HTMLInputElement).value;
        });
    }
  }

  protected update() {
    (this.element.querySelector('#setting-name') as HTMLInputElement).value = this.state.name;
    (this.element.querySelector('#setting-bio') as HTMLTextAreaElement).value = this.state.bio;
    (this.element.querySelector('#setting-fp') as HTMLElement).innerText = this.state.fingerprint;

    (this.element.querySelector('#pref-auto-discover') as HTMLInputElement).checked = this.state.autoDiscover;
    (this.element.querySelector('#pref-interval') as HTMLInputElement).value = this.state.discoverInterval.toString();
    (this.element.querySelector('#pref-similarity') as HTMLInputElement).value = this.state.similarityThreshold.toString();
    (this.element.querySelector('#pref-theme') as HTMLSelectElement).value = this.state.theme;
    (this.element.querySelector('#pref-notifications') as HTMLInputElement).checked = this.state.notifications;

    const simVal = this.element.querySelector('#pref-similarity-val');
    if (simVal) simVal.textContent = this.state.similarityThreshold.toString();
  }
}
