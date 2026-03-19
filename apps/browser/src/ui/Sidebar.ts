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
      <div class="irc-sidebar-header" style="padding: 16px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; justify-content: space-between;">
        <h2 style="font-size: 20px; font-weight: bold; margin: 0;">ISC</h2>
        <div id="status-indicator" class="status-indicator status-offline" title="Status: offline" style="width: 10px; height: 10px; border-radius: 50%; background: #d93025; box-shadow: 0 0 0 2px rgba(217,48,37,0.2);"></div>
      </div>

      <div class="irc-sidebar-section" style="padding: 20px 0;">
        <ul class="irc-nav-list" style="list-style: none; padding: 0; margin: 0;">
          <li class="irc-nav-item" data-tab="now" style="padding: 12px 20px; cursor: pointer; display: flex; align-items: center; gap: 12px; font-size: 16px; font-weight: 500; transition: background 0.2s;">
            <span class="icon" style="font-size: 20px;">🏠</span> Now
          </li>
          <li class="irc-nav-item" data-tab="discover" style="padding: 12px 20px; cursor: pointer; display: flex; align-items: center; gap: 12px; font-size: 16px; font-weight: 500; transition: background 0.2s;">
            <span class="icon" style="font-size: 20px;">📡</span> Discover
          </li>
          <li class="irc-nav-item" data-tab="communities" style="padding: 12px 20px; cursor: pointer; display: flex; align-items: center; gap: 12px; font-size: 16px; font-weight: 500; transition: background 0.2s;">
            <span class="icon" style="font-size: 20px;">👥</span> Communities
          </li>
          <li class="irc-nav-item" data-tab="places" style="padding: 12px 20px; cursor: pointer; display: flex; align-items: center; gap: 12px; font-size: 16px; font-weight: 500; transition: background 0.2s;">
            <span class="icon" style="font-size: 20px;">🗺️</span> Places
          </li>
          <li class="irc-nav-item" data-tab="video" data-testid="nav-video-calls" style="padding: 12px 20px; cursor: pointer; display: flex; align-items: center; gap: 12px; font-size: 16px; font-weight: 500; transition: background 0.2s;">
            <span class="icon" style="font-size: 20px;">📹</span> Video
          </li>
          <li class="irc-nav-item" data-tab="chats" style="padding: 12px 20px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; font-size: 16px; font-weight: 500; transition: background 0.2s;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span class="icon" style="font-size: 20px;">💬</span> Chats
            </div>
            <span id="badge-chats" style="background: #1da1f2; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; display: none;"></span>
          </li>
          <li class="irc-nav-item" data-tab="settings" style="padding: 12px 20px; cursor: pointer; display: flex; align-items: center; gap: 12px; font-size: 16px; font-weight: 500; transition: background 0.2s;">
            <span class="icon" style="font-size: 20px;">⚙️</span> Settings
          </li>
          <li class="irc-nav-item" data-tab="compose" style="padding: 12px 20px; cursor: pointer; display: flex; align-items: center; gap: 12px; font-size: 16px; font-weight: 500; transition: background 0.2s; margin-top: 10px;">
            <div style="background: #1da1f2; color: white; width: 100%; text-align: center; padding: 10px; border-radius: 20px; font-weight: bold;">
              + Post
            </div>
          </li>
        </ul>
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

        // Inline styles for status
        if (connectionStatus === 'online') {
            statusInd.style.background = '#17bf63';
            statusInd.style.boxShadow = '0 0 0 2px rgba(23,191,99,0.2)';
        } else {
            statusInd.style.background = '#d93025';
            statusInd.style.boxShadow = '0 0 0 2px rgba(217,48,37,0.2)';
        }
      }
    }

    // 2. Update Active Tab classes
    if (prevProps.activeTab !== activeTab) {
      this.element.querySelectorAll('.irc-nav-item').forEach(item => {
        const hItem = item as HTMLElement;
        if (hItem.dataset.tab === activeTab) {
          hItem.classList.add('active');
          hItem.style.background = 'rgba(255, 255, 255, 0.1)';
          hItem.style.color = 'white';
          hItem.style.borderRight = '4px solid #1da1f2';
        } else {
          hItem.classList.remove('active');
          hItem.style.background = 'transparent';
          hItem.style.color = 'var(--text-secondary, #94a3b8)';
          hItem.style.borderRight = 'none';
        }
      });
    }

    // 3. Update Badges (prefer props.badges, fallback to local heuristic)
    try {
        let unreadCount = 0;
        if (this.props.badges && typeof this.props.badges['chats'] === 'number') {
            unreadCount = this.props.badges['chats'];
        } else {
            // Simple heuristic if no external badge provider
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('isc-messages-')) {
                    const stored = localStorage.getItem(key);
                    const msgs = stored ? JSON.parse(stored) : [];
                    // Using a simple logic to say it has messages, it might be unread.
                    if (msgs.length > 0 && msgs.some((m: any) => !m.fromMe)) {
                         // Real unread logic would track lastRead timestamps per peer
                         unreadCount += 1;
                    }
                }
            }
        }

        const badgeEl = this.element.querySelector('#badge-chats') as HTMLElement;
        if (badgeEl) {
            if (unreadCount > 0) {
                badgeEl.style.display = 'inline-block';
                badgeEl.textContent = unreadCount.toString();
            } else {
                badgeEl.style.display = 'none';
            }
        }
    } catch (e) {
        console.warn('Failed to calculate unread chats', e);
    }
  }
}
