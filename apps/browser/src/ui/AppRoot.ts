import { UIComponent } from './Component.js';
import { Sidebar } from './Sidebar.js';
import { NowScreen } from './screens/NowScreen.js';
import { DiscoverScreen } from './screens/DiscoverScreen.js';
import { VideoCallScreen } from './screens/VideoCallScreen.js';
import { ChatsScreen } from './screens/ChatsScreen.js';
import { SettingsScreen } from './screens/SettingsScreen.js';
import { ComposeScreen } from './screens/ComposeScreen.js';
import { CommunitiesScreen } from './screens/CommunitiesScreen.js';

interface AppRootState {
  route: string;
  loading: boolean;
  connectionStatus: string;
}

export class AppRoot extends UIComponent<any, AppRootState> {
  constructor() {
    super('div', {}, { route: 'now', loading: true, connectionStatus: 'offline' });
    this.element.id = 'isc-app-root';
    this.element.className = 'irc-layout';
  }

  public setReady() {
    this.setState({ loading: false });

    // Subscribe to network status changes once ready
    if (this.props.dependencies && this.props.dependencies.networkService) {
      const net = this.props.dependencies.networkService;
      net.on('peer:connect', () => this.updateConnectionStatus('online'));
      net.on('peer:disconnect', () => {
        // Safe check for connected peers
        if (typeof net.getConnectedPeers === 'function' && net.getConnectedPeers().length === 0) {
          this.updateConnectionStatus('offline');
        }
      });
      // Initial status
      if (typeof net.getConnectedPeers === 'function' && net.getConnectedPeers().length > 0) {
        this.updateConnectionStatus('online');
      }
    }
  }

  private updateConnectionStatus(status: string) {
    if (this.state.connectionStatus !== status) {
      this.setState({ connectionStatus: status });
    }
  }

  private handleTabClick = (tabId: string) => {
    console.log('[AppRoot] Navigating to:', tabId);
    this.setState({ route: tabId });
  };

  protected render() {
    // Initial static HTML wrapper structure
    this.element.innerHTML = `
      <div id="splash-container" style="display: none; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: var(--bg-primary, #f5f5f5);">
        <h1>ISC</h1>
        <p>Initializing P2P Network...</p>
        <div class="progress-bar" style="width: 200px; height: 4px; background: #ddd; margin-top: 20px; border-radius: 2px; overflow: hidden;">
          <div style="width: 100%; height: 100%; background: #007bff; animation: indeterminate 1.5s infinite linear;"></div>
        </div>
      </div>
      <div id="app-layout" style="display: none; height: 100%; width: 100%;">
        <div id="sidebar-container"></div>
        <main class="irc-main">
          <div class="app-content" id="main-content" style="height: 100%; width: 100%;"></div>
        </main>
      </div>
    `;

    // Listen for custom navigation events from children
    this.element.addEventListener('navigate', ((e: CustomEvent) => {
       if (e.detail && e.detail.route) {
          this.handleTabClick(e.detail.route);
       }
    }) as EventListener);
  }

  protected update(prevState: AppRootState, prevProps: any) {
    const splash = this.element.querySelector('#splash-container') as HTMLElement;
    const layout = this.element.querySelector('#app-layout') as HTMLElement;

    // Handle loading vs ready state
    if (this.state.loading) {
      splash.style.display = 'flex';
      layout.style.display = 'none';
      return; // Wait until ready
    } else {
      splash.style.display = 'none';
      layout.style.display = 'flex';
    }

    // 1. Mount or Update Sidebar
    let sidebar = this.children.get('sidebar') as Sidebar;
    if (!sidebar) {
      sidebar = new Sidebar({
        activeTab: this.state.route,
        onTabClick: this.handleTabClick,
        connectionStatus: this.state.connectionStatus,
      });
      this.appendChildComponent('sidebar', sidebar, '#sidebar-container');
    } else if (prevState.route !== this.state.route || prevState.connectionStatus !== this.state.connectionStatus) {
      sidebar.setProps({
        activeTab: this.state.route,
        connectionStatus: this.state.connectionStatus,
      });
    }

    // 2. Mount or switch main content screen based on route
    if (prevState.route !== this.state.route || !this.children.has('screen')) {
      let activeScreen: UIComponent<any, any>;

      switch (this.state.route) {
        case 'discover':
          activeScreen = new DiscoverScreen({ dependencies: this.props.dependencies });
          break;
        case 'video':
          activeScreen = new VideoCallScreen({ dependencies: this.props.dependencies });
          break;
        case 'chats':
          activeScreen = new ChatsScreen({ dependencies: this.props.dependencies });
          break;
        case 'settings':
          activeScreen = new SettingsScreen({ dependencies: this.props.dependencies });
          break;
        case 'compose':
          activeScreen = new ComposeScreen({ dependencies: this.props.dependencies });
          break;
        case 'communities':
          activeScreen = new CommunitiesScreen({ dependencies: this.props.dependencies });
          break;
        case 'now':
        default:
          activeScreen = new NowScreen({ dependencies: this.props.dependencies });
          break;
      }
      this.appendChildComponent('screen', activeScreen, '#main-content');
    }
  }
}
