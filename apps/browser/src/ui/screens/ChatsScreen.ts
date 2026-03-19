import { UIComponent } from '../Component.js';
import { escapeHTML } from '../utils/dom.js';

interface ChatsState {
  conversations: any[];
  selectedConversation: string | null;
  messages: any[];
  inputValue: string;
  isOffline: boolean;
}

export class ChatsScreen extends UIComponent<any, ChatsState> {
  private networkSub: any = null;
  private onlineHandler: any = null;
  private offlineHandler: any = null;

  constructor(props: any) {
    super('div', props, { conversations: [], selectedConversation: null, messages: [], inputValue: '', isOffline: !navigator.onLine });
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
    const stored = localStorage.getItem(`isc-messages-${id}`);
    const messages = stored ? JSON.parse(stored) : [];
    this.setState({ selectedConversation: id, messages });
  }

  private async handleSendMessage(content: string) {
    if (!content.trim() || !this.state.selectedConversation) return;

    const newMessage = {
      id: `msg_${Date.now()}`,
      conversationId: this.state.selectedConversation,
      content: content.trim(),
      fromMe: true,
      timestamp: Date.now(),
    };

    const updatedMessages = [...this.state.messages, newMessage];
    this.setState({ messages: updatedMessages });
    localStorage.setItem(`isc-messages-${this.state.selectedConversation}`, JSON.stringify(updatedMessages));

    // Also update preview text in conversation list
    const updatedConvos = this.state.conversations.map(c =>
      c.id === this.state.selectedConversation
        ? { ...c, lastMessage: content.trim(), timestamp: Date.now() }
        : c
    );
    this.setState({ conversations: updatedConvos });

    try {
      const { chat } = this.props.dependencies || {};
      if (chat && chat.send) {
        await chat.send(this.state.selectedConversation, newMessage.content);
        console.log('[Chats] Message sent via WebRTC');
      }
    } catch (e) {
      console.warn('[Chats] WebRTC send failed, queued locally', e);
    }
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
      <div style="display: flex; flex: 1; min-height: 500px; border-top: 1px solid #e1e8ed;">
        <div id="chats-sidebar" style="width: 320px; border-right: 1px solid #e1e8ed; overflow-y: auto; background: white;"></div>
        <div id="chats-main" style="flex: 1; display: flex; flex-direction: column; background: #f5f8fa;"></div>
      </div>
    `;

    // Use event delegation for clicking a conversation
    this.element.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('.conversation-item') as HTMLElement;
      if (target && target.dataset.id) {
        this.handleSelectConversation(target.dataset.id);
      }

      const sendBtn = (e.target as HTMLElement).closest('#send-btn');
      if (sendBtn) {
        const input = this.element.querySelector('#chat-input') as HTMLInputElement;
        if (input) {
          this.handleSendMessage(input.value);
          input.value = ''; // clear only on trigger
        }
      }
    });

    this.element.addEventListener('keypress', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const input = e.target as HTMLInputElement;
        if (input && input.id === 'chat-input') {
          this.handleSendMessage(input.value);
          input.value = '';
        }
      }
    });
  }

  protected update(prevState: ChatsState) {
    const sidebar = this.element.querySelector('#chats-sidebar');
    const main = this.element.querySelector('#chats-main');
    const offlineBanner = this.element.querySelector('#offline-banner-container');
    if (!sidebar || !main || !offlineBanner) return;

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

    // 1. Render Sidebar (Safe to overwrite entirely since it has no typing state)
    if (prevState.conversations !== this.state.conversations || prevState.selectedConversation !== this.state.selectedConversation) {
      if (this.state.conversations.length === 0) {
        sidebar.innerHTML = '<div style="padding: 20px; text-align: center; color: #657786;"><p>No conversations yet.</p><p style="font-size: 12px;">Discover peers first.</p></div>';
      } else {
        sidebar.innerHTML = this.state.conversations.map(c => `
          <div class="conversation-item ${c.id === this.state.selectedConversation ? 'active' : ''}" data-id="${escapeHTML(c.id)}" style="padding: 12px 16px; border-bottom: 1px solid #e1e8ed; cursor: pointer; background: ${c.id === this.state.selectedConversation ? '#e8f4fd' : 'transparent'};">
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">${escapeHTML(c.peer?.name || 'Anonymous')} <span style="font-size: 11px; color: #1da1f2; background: #e8f4fd; padding: 2px 6px; border-radius: 10px;">${Math.round(c.similarity * 100)}%</span></div>
            <div style="font-size: 13px; color: #657786; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(c.lastMessage || 'Start a conversation...')}</div>
          </div>
        `).join('');
      }
    }

    // 2. Render Main Chat Area (Surgical update to prevent state destruction)
    if (!this.state.selectedConversation) {
      if (prevState.selectedConversation !== this.state.selectedConversation) {
        main.innerHTML = `
          <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #657786;">
            <div style="font-size: 64px; margin-bottom: 20px;">💬</div>
            <h2>Select a Conversation</h2>
          </div>
        `;
      }
    } else {
      const activeConvo = this.state.conversations.find(c => c.id === this.state.selectedConversation);
      const peerName = activeConvo?.peer?.name || 'Peer';

      // If the conversation changed entirely, build the full skeleton once
      if (prevState.selectedConversation !== this.state.selectedConversation) {
        main.innerHTML = `
          <div style="padding: 16px; background: white; border-bottom: 1px solid #e1e8ed; font-weight: bold;">
            Chat with ${escapeHTML(peerName)}
          </div>
          <div id="messages-list" style="flex: 1; padding: 20px; overflow-y: auto;"></div>
          <div style="padding: 16px; background: white; border-top: 1px solid #e1e8ed; display: flex; gap: 12px;">
            <input type="text" id="chat-input" placeholder="Type a message..." style="flex: 1; padding: 12px 16px; border: 1px solid #e1e8ed; border-radius: 20px; outline: none;" />
            <button id="send-btn" style="padding: 12px 24px; background: #1da1f2; color: white; border: none; border-radius: 20px; font-weight: bold; cursor: pointer;">Send</button>
          </div>
        `;
      }

      // Surgically render messages into the container without wiping the input
      const list = main.querySelector('#messages-list');
      if (list && prevState.messages !== this.state.messages) {
        if (this.state.messages.length === 0) {
          list.innerHTML = '<p style="text-align: center; color: #657786;">Say hello!</p>';
        } else {
          list.innerHTML = this.state.messages.map(m => `
            <div style="display: flex; flex-direction: column; align-items: ${m.fromMe ? 'flex-end' : 'flex-start'}; margin-bottom: 12px;">
                <div style="max-width: 70%; padding: 12px 16px; border-radius: 18px; font-size: 14px; line-height: 1.4; ${m.fromMe ? 'background: #1da1f2; color: white;' : 'background: #e1e8ed; color: #14171a;'}">
                  ${escapeHTML(m.content)}
                </div>
                <div style="font-size: 11px; opacity: 0.7; margin-top: 4px; color: #657786;">${new Date(m.timestamp).toLocaleTimeString()}</div>
            </div>
          `).join('');
        }
        list.scrollTop = list.scrollHeight;
      }
    }
  }
}
