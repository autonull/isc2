import { UIComponent } from '../Component.js';
import { escapeHTML } from '../utils/dom.js';
import { ChatPanel } from '../components/ChatPanel.js';

interface ChatsState {
  conversations: any[];
  selectedConversation: string | null;
  isOffline: boolean;
  filterMode: 'all' | 'unread';
}

export class ChatsScreen extends UIComponent<any, ChatsState> {
  private networkSub: any = null;
  private onlineHandler: any = null;
  private offlineHandler: any = null;
  private refreshInterval: any = null;

  constructor(props: any) {
    super('div', props, { conversations: [], selectedConversation: null, isOffline: !navigator.onLine, filterMode: 'all' });
    this.element.className = 'screen chats-screen';
    this.element.dataset.testid = 'chats-screen';
  }

  protected async onMount() {
    await this.loadConversations();

    const { networkService } = this.props.dependencies || {};
    if (networkService && networkService.on) {
      this.networkSub = networkService.on('onPeerDiscovered', () => {
        // Debounce or just reload conversations periodically if they depend on matches
        this.loadConversations();
      });
    }

    this.onlineHandler = () => this.setState({ isOffline: false });
    this.offlineHandler = () => this.setState({ isOffline: true });
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);

    // Periodically refresh relative timestamps
    this.refreshInterval = setInterval(() => this.update(this.state), 60000);
  }

  private async loadConversations() {
    const { chat, networkService } = this.props.dependencies || {};
    let convos: any[] = [];

    // 1. Get persisted conversations
    if (chat && chat.getConversations) {
      convos = await chat.getConversations();
    }

    // 2. Merge with current active matches if networkService exists to show similarity
    if (networkService && networkService.getMatches) {
      const matches = networkService.getMatches();
      matches.forEach((match: any) => {
        const existingIdx = convos.findIndex(c => c.participantId === match.peer.id);
        if (existingIdx >= 0) {
          convos[existingIdx].similarity = match.similarity;
          convos[existingIdx].peer = match.peer;
        } else {
          // It's a match but no conversation started yet. In a real app, you might not show
          // empty conversations in the Chats list until a message is sent, but for now
          // we'll show them to allow starting a chat easily from this screen as well.
          convos.push({
            id: match.peer.id,
            participantId: match.peer.id,
            participantName: match.peer.name || `@${match.peer.id.substring(0,8)}`,
            similarity: match.similarity,
            peer: match.peer,
            unreadCount: 0,
            updatedAt: Date.now() // Fake sort order
          });
        }
      });
    }

    // Sort by most recent
    convos.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    this.setState({ conversations: convos });
  }

  protected onUnmount() {
    if (typeof this.networkSub === 'function') {
      this.networkSub();
    }
    if (this.onlineHandler) window.removeEventListener('online', this.onlineHandler);
    if (this.offlineHandler) window.removeEventListener('offline', this.offlineHandler);
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  private handleSelectConversation(participantId: string) {
    this.setState({ selectedConversation: participantId });
  }

  private formatTimeRelative(ms: number): string {
    if (!ms) return '';
    const diff = Date.now() - ms;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    return `${Math.floor(hours / 24)} d ago`;
  }

  private getSimilarityBars(sim: number): string {
    if (sim >= 0.85) return '<span style="color:#17bf63">▐▌▐▌▐</span>';
    if (sim >= 0.70) return '<span style="color:#1da1f2">▐▌▐▌░</span>';
    if (sim >= 0.55) return '<span style="color:#657786">▐▌░░░</span>';
    return '<span style="color:#aab8c2">░░░░░</span>';
  }

  protected render() {
    this.element.innerHTML = `
      <div class="channel-header" style="padding: 16px 20px; border-bottom: 1px solid #e1e8ed; background: white; display: flex; justify-content: space-between; align-items: center;">
        <h2 style="font-size: 20px; font-weight: bold; margin: 0; color: #14171a;">Chats</h2>
        <div style="display: flex; background: #e1e8ed; border-radius: 6px; padding: 2px;">
           <button id="filter-all-btn" style="padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px; background: white; color: #14171a; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">All</button>
           <button id="filter-unread-btn" style="padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px; background: transparent; color: #657786;">Unread</button>
        </div>
      </div>
      <div id="offline-banner-container"></div>
      <div style="display: flex; flex: 1; flex-direction: column; min-height: 500px; background: #f5f8fa;">
        <div id="chats-list" style="flex: 1; overflow-y: auto;"></div>
      </div>
      <div id="chat-panel-container"></div>
    `;

    // Filter toggles
    const allBtn = this.element.querySelector('#filter-all-btn');
    const unreadBtn = this.element.querySelector('#filter-unread-btn');

    allBtn?.addEventListener('click', () => this.setState({ filterMode: 'all' }));
    unreadBtn?.addEventListener('click', () => this.setState({ filterMode: 'unread' }));

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
    const allBtn = this.element.querySelector('#filter-all-btn') as HTMLElement;
    const unreadBtn = this.element.querySelector('#filter-unread-btn') as HTMLElement;

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

    if (prevState.filterMode !== this.state.filterMode) {
        if (this.state.filterMode === 'all') {
            allBtn.style.background = 'white'; allBtn.style.color = '#14171a'; allBtn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
            unreadBtn.style.background = 'transparent'; unreadBtn.style.color = '#657786'; unreadBtn.style.boxShadow = 'none';
        } else {
            unreadBtn.style.background = 'white'; unreadBtn.style.color = '#14171a'; unreadBtn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
            allBtn.style.background = 'transparent'; allBtn.style.color = '#657786'; allBtn.style.boxShadow = 'none';
        }
    }

    // 1. Render List
    let visibleConvos = this.state.conversations;
    if (this.state.filterMode === 'unread') {
        visibleConvos = visibleConvos.filter(c => c.unreadCount && c.unreadCount > 0);
    }

    if (visibleConvos.length === 0) {
      listContainer.innerHTML = `
        <div style="padding: 60px 20px; text-align: center; color: #657786;">
            <div style="font-size: 48px; margin-bottom: 16px;">💬</div>
            <h3 style="margin: 0 0 8px 0; font-size: 18px;">No active conversations yet.</h3>
            <p style="margin: 0; font-size: 14px;">Find your thought neighbors in Now or Discover.</p>
        </div>
      `;
    } else {
      listContainer.innerHTML = visibleConvos.map(c => `
        <div class="conversation-item" data-id="${escapeHTML(c.participantId)}" style="background: white; margin: 8px 16px; padding: 16px; border-radius: 12px; border: 1px solid #e1e8ed; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: box-shadow 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
          <div style="flex: 1; min-width: 0; padding-right: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                <div style="font-weight: bold; font-size: 16px; color: #14171a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${escapeHTML(c.participantName || `@${c.participantId.substring(0,8)}`)}
                </div>
                <span style="font-size: 12px; color: #657786; margin-left: 8px; flex-shrink: 0;">${this.formatTimeRelative(c.updatedAt)}</span>
            </div>
            <div style="font-size: 14px; color: ${c.unreadCount > 0 ? '#14171a' : '#657786'}; font-weight: ${c.unreadCount > 0 ? 'bold' : 'normal'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 6px;">
                ${escapeHTML(c.lastMessage || 'Start a conversation...')}
            </div>
            <div style="font-size: 12px; color: #657786;">
                via Discover · ${this.getSimilarityBars(c.similarity || 0)} ${(c.similarity ? Math.round(c.similarity * 100) : 0)}%
            </div>
          </div>
          ${c.unreadCount > 0 ? `<div style="background: #1da1f2; color: white; border-radius: 12px; padding: 2px 8px; font-size: 12px; font-weight: bold;">${c.unreadCount}</div>` : ''}
        </div>
      `).join('');
    }

    // 2. Render Chat Panel Overlay
    if (prevState.selectedConversation !== this.state.selectedConversation) {
      if (this.state.selectedConversation) {
        const activeConvo = this.state.conversations.find(c => c.participantId === this.state.selectedConversation);
        const targetPeerId = this.state.selectedConversation;
        const targetPeerName = activeConvo?.participantName || `@${targetPeerId.substring(0, 8)}`;

        let chatPanel = this.children.get('chat-panel') as ChatPanel;
        if (!chatPanel) {
          chatPanel = new ChatPanel({
            peerId: targetPeerId,
            peerName: targetPeerName,
            similarity: activeConvo?.similarity || 0,
            dependencies: this.props.dependencies,
            onClose: () => {
               this.setState({ selectedConversation: null });
               this.loadConversations(); // refresh list on close to get latest messages/timestamps
            }
          });
          this.appendChildComponent('chat-panel', chatPanel, '#chat-panel-container');
        } else {
          chatPanel.setProps({
            peerId: targetPeerId,
            peerName: targetPeerName,
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
