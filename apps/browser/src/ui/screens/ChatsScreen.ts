import { UIComponent } from '../Component.js';
import { escapeHTML } from '../utils/dom.js';
import { ChatPanel } from '../components/ChatPanel.js';

interface ChatsState {
  conversations: any[];
  selectedConversation: string | null;
  isOffline: boolean;
}

export class ChatsScreen extends UIComponent<any, ChatsState> {
  private networkSub: any = null;
  private onlineHandler: any = null;
  private offlineHandler: any = null;

  constructor(props: any) {
    super('div', props, { conversations: [], selectedConversation: null, isOffline: !navigator.onLine });
    this.element.className = 'screen chats-screen';
  }

  protected async onMount() {
    const { networkService } = this.props.dependencies || {};
    if (networkService) {
      const matches = networkService.getMatches ? networkService.getMatches() : [];
      const convos = matches.map((match: any) => ({
        id: match.peer.id,
        peer: match.peer,
        similarity: match.similarity,
        unread: 0,
      }));
      this.setState({ conversations: convos });

      if (networkService.on) {
        this.networkSub = networkService.on('onPeerDiscovered', (match: any) => {
          if (!this.state.conversations.some(c => c.id === match.peer.id)) {
            this.setState({
              conversations: [{
                id: match.peer.id,
                peer: match.peer,
                similarity: match.similarity,
                unread: 0,
              }, ...this.state.conversations]
            });
          }
        });
      }
    }

    this.onlineHandler = () => this.setState({ isOffline: false });
    this.offlineHandler = () => this.setState({ isOffline: true });
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
  }

  protected onUnmount() {
    if (typeof this.networkSub === 'function') {
      this.networkSub();
    }
    if (this.onlineHandler) window.removeEventListener('online', this.onlineHandler);
    if (this.offlineHandler) window.removeEventListener('offline', this.offlineHandler);
  }

  private handleSelectConversation(id: string) {
    this.setState({ selectedConversation: id });
  }

  protected render() {
    const offlineBannerHtml = this.state.isOffline ? `
      <div data-testid="offline-indicator" style="background: #fff3cd; color: #856404; padding: 8px 20px; font-size: 13px; text-align: center; border-bottom: 1px solid #ffc107;">
        📡 You're offline — messages will be queued and sent when reconnected
      </div>
    ` : '';

    this.element.innerHTML = `
      <div class="channel-header" style="padding: 16px 20px; border-bottom: 1px solid #e1e8ed; background: white;">
        <h2 style="font-size: 20px; font-weight: bold; margin: 0; color: #14171a;">💬 Chats</h2>
      </div>
      <div id="offline-banner-container">${offlineBannerHtml}</div>
      <div style="display: flex; flex: 1; flex-direction: column; min-height: 500px; border-top: 1px solid #e1e8ed;">
        <div id="chats-list" style="flex: 1; overflow-y: auto; background: white;"></div>
      </div>
    `;

    // Use event delegation for clicking a conversation
    this.element.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('.conversation-item') as HTMLElement;
      if (target && target.dataset.id) {
        this.handleSelectConversation(target.dataset.id);
      }
    });
  }

  protected update(prevState: ChatsState) {
    const listContainer = this.element.querySelector('#chats-list');
    const offlineBanner = this.element.querySelector('#offline-banner-container');
    if (!listContainer || !offlineBanner) return;

    if (prevState.isOffline !== this.state.isOffline) {
      if (this.state.isOffline) {
        offlineBanner.innerHTML = `
          <div data-testid="offline-indicator" style="background: #fff3cd; color: #856404; padding: 8px 20px; font-size: 13px; text-align: center; border-bottom: 1px solid #ffc107;">
            📡 You're offline — messages will be queued and sent when reconnected
          </div>
        `;
      } else {
        offlineBanner.innerHTML = '';
      }
    }

    // 1. Render List
    if (prevState.conversations !== this.state.conversations || prevState.selectedConversation !== this.state.selectedConversation) {
      if (this.state.conversations.length === 0) {
        listContainer.innerHTML = '<div style="padding: 40px 20px; text-align: center; color: #657786;"><p>No conversations yet.</p><p style="font-size: 14px;">Discover peers first.</p></div>';
      } else {
        listContainer.innerHTML = this.state.conversations.map(c => `
          <div class="conversation-item" data-id="${escapeHTML(c.id)}" style="padding: 16px 20px; border-bottom: 1px solid #e1e8ed; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: background 0.2s;">
            <div style="flex: 1; min-width: 0; padding-right: 16px;">
              <div style="font-weight: bold; font-size: 16px; margin-bottom: 6px; color: #14171a; display: flex; align-items: center;">
                ${escapeHTML(c.peer?.name || 'Anonymous')}
                <span style="margin-left: 8px; font-size: 12px; font-weight: normal; color: #1da1f2; background: #e8f4fd; padding: 2px 8px; border-radius: 12px;">${Math.round(c.similarity * 100)}% match</span>
              </div>
              <div style="font-size: 14px; color: #657786; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(c.lastMessage || 'Start a conversation...')}</div>
            </div>
            <div style="font-size: 20px; color: #aab8c2;">
              ›
            </div>
          </div>
        `).join('');
      }
    }

    // 2. Render Chat Panel Overlay
    if (prevState.selectedConversation !== this.state.selectedConversation) {
      if (this.state.selectedConversation) {
        const activeConvo = this.state.conversations.find(c => c.id === this.state.selectedConversation);
        const targetPeer = activeConvo?.peer || { id: this.state.selectedConversation, name: 'Peer' };

        let chatPanel = this.children.get('chat-panel') as ChatPanel;
        if (!chatPanel) {
          chatPanel = new ChatPanel({
            peerId: targetPeer.id,
            peerName: targetPeer.name || targetPeer.id.substring(0, 8),
            similarity: activeConvo?.similarity || 0,
            dependencies: this.props.dependencies,
            onClose: () => this.setState({ selectedConversation: null })
          });
          // Since .chats-screen is the root element and querySelector searches descendants,
          // we should append it to a wrapper container inside the root, or directly to the root element.
          // Given the component API, we can use '#chats-list' or create a dedicated overlay container.
          // Here we append it to the body or the root element if supported.
          // By default, if the selector is not found, we fallback to appending to this.element.
          this.appendChildComponent('chat-panel', chatPanel, '#offline-banner-container');
        } else {
          chatPanel.setProps({
            peerId: targetPeer.id,
            peerName: targetPeer.name || targetPeer.id.substring(0, 8),
            similarity: activeConvo?.similarity || 0
          });
        }
      } else {
        const existing = this.children.get('chat-panel');
        if (existing) {
          existing.unmount();
          this.children.delete('chat-panel');
        }
      }
    }
  }
}
