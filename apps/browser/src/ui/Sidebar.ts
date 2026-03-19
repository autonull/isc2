import { UIComponent } from './Component.js';

export interface SidebarProps {
  activeTab: string;
  onTabClick: (tabId: string) => void;
  badges?: Record<string, number>;
  channels?: any[];
  connectionStatus?: string;
}

export class Sidebar extends UIComponent<SidebarProps, any> {
  constructor(props: SidebarProps) {
    super('aside', props);
    this.element.className = 'irc-sidebar';
    this.element.dataset.testid = 'sidebar';
  }

  protected render() {
    // Render static structure exactly once
    this.element.innerHTML = `
      <div class="irc-sidebar-header">
        <h2>ISC Node</h2>
        <div id="status-indicator" class="status-indicator status-offline" title="Status: offline"></div>
      </div>

      <div class="irc-sidebar-section">
        <h3>Network</h3>
        <ul class="irc-nav-list">
          <li class="irc-nav-item" data-tab="now">
            <span class="icon">#</span> Global Feed
          </li>
          <li class="irc-nav-item" data-tab="discover">
            <span class="icon">@</span> Discover
          </li>
          <li class="irc-nav-item" data-tab="chats">
            <span class="icon">✉</span> Chats <span id="badge-chats"></span>
          </li>
          <li class="irc-nav-item" data-tab="video">
            <span class="icon">📹</span> Video Calls
          </li>
        </ul>
      </div>

      <div class="irc-sidebar-section">
        <h3>Channels</h3>
        <ul class="irc-channel-list">
          <li class="irc-nav-item" data-tab="channels">
            <span class="icon">+</span> Join/Create Channel
          </li>
        </ul>
      </div>

      <div class="irc-sidebar-footer">
        <button class="irc-settings-btn" data-tab="settings">
          ⚙ Settings
        </button>
      </div>
    `;

    // Attach event listeners permanently
    this.element.querySelectorAll('.irc-nav-item, .irc-settings-btn').forEach(item => {
      item.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const tab = target.dataset.tab;
        if (tab && this.props.onTabClick) {
          this.props.onTabClick(tab);
        }
      });
    });
  }

  protected update(prevState: any, prevProps: SidebarProps) {
    const { activeTab, badges = {}, connectionStatus = 'offline' } = this.props;

    // 1. Update Connection Status precisely
    if (prevProps.connectionStatus !== connectionStatus) {
      const statusInd = this.element.querySelector('#status-indicator') as HTMLElement;
      if (statusInd) {
        statusInd.className = `status-indicator status-${connectionStatus}`;
        statusInd.title = `Status: ${connectionStatus}`;
      }
    }

    // 2. Update Active Tab classes
    if (prevProps.activeTab !== activeTab) {
      this.element.querySelectorAll('.irc-nav-item').forEach(item => {
        const hItem = item as HTMLElement;
        if (hItem.dataset.tab === activeTab) {
          hItem.classList.add('active');
        } else {
          hItem.classList.remove('active');
        }
      });
    }

    // 3. Update Badges
    const badgeEl = this.element.querySelector('#badge-chats');
    if (badgeEl) {
      if (badges['chats']) {
        badgeEl.innerHTML = `<span class="badge">${badges['chats']}</span>`;
      } else {
        badgeEl.innerHTML = '';
      }
    }
  }
}
