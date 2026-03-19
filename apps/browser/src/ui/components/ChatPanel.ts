import { UIComponent } from '../Component.js';
import { escapeHTML } from '../utils/dom.js';

interface ChatPanelProps {
  peerId: string;
  peerName: string;
  similarity: number;
  onClose: () => void;
  dependencies: any;
}

interface ChatPanelState {
  messages: any[];
  inputText: string;
  isExpanded: boolean;
}

export class ChatPanel extends UIComponent<ChatPanelProps, ChatPanelState> {
  private messagesEndRef: HTMLDivElement | null = null;

  constructor(props: ChatPanelProps) {
    super('div', props, { messages: [], inputText: '', isExpanded: false });

    // Base styles for overlay panel
    this.element.style.position = 'fixed';
    this.element.style.bottom = '0';
    this.element.style.right = '20px';
    this.element.style.width = '350px';
    this.element.style.background = '#fff';
    this.element.style.border = '1px solid #e1e8ed';
    this.element.style.borderRadius = '12px 12px 0 0';
    this.element.style.boxShadow = '0 -2px 10px rgba(0,0,0,0.1)';
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.zIndex = '1000';
    this.element.style.transition = 'height 0.3s ease';

    // Init styles based on state
    this.element.style.height = '400px';
  }

  protected onMount() {
    this.loadMessages();
  }

  private async loadMessages() {
    const { chat } = this.props.dependencies || {};

    // First try the local storage fast path
    const stored = localStorage.getItem(`isc-messages-${this.props.peerId}`);
    if (stored) {
        try {
            this.setState({ messages: JSON.parse(stored) });
            this.scrollToBottom();
        } catch (e) {}
    }

    // Then sync with the actual chat service db
    if (chat && chat.getMessages && chat.createConversation) {
        try {
            // Ensure conversation exists so we can get its ID if we need it
            const conv = await chat.createConversation(this.props.peerId);
            const messages = await chat.getMessages(conv.id);
            if (messages && messages.length > 0) {
               // Map db messages to the format expected by the UI
               const formattedMsgs = messages.map((m: any) => ({
                   id: m.id,
                   conversationId: m.conversationId,
                   content: m.content,
                   fromMe: m.senderId !== this.props.peerId,
                   timestamp: m.timestamp
               }));
               this.setState({ messages: formattedMsgs });
               localStorage.setItem(`isc-messages-${this.props.peerId}`, JSON.stringify(formattedMsgs));
               this.scrollToBottom();
            }
        } catch (e) {
            console.warn('[ChatPanel] Failed to load messages from DB', e);
        }
    }
  }

  private async sendMessage(content: string) {
      if (!content.trim()) return;

      const newMessage = {
        id: `msg_${Date.now()}`,
        conversationId: this.props.peerId,
        content: content.trim(),
        fromMe: true,
        timestamp: Date.now(),
      };

      const updatedMessages = [...this.state.messages, newMessage];
      this.setState({ messages: updatedMessages, inputText: '' });

      const input = this.element.querySelector('#chat-input') as HTMLInputElement;
      if (input) input.value = '';

      localStorage.setItem(`isc-messages-${this.props.peerId}`, JSON.stringify(updatedMessages));
      this.scrollToBottom();

      try {
        const { chat } = this.props.dependencies || {};
        if (chat && chat.send && chat.createConversation) {
          const conv = await chat.createConversation(this.props.peerId);
          await chat.send(conv.id, content);
        }
      } catch (e) {
        console.warn('[ChatPanel] WebRTC send failed, queued locally', e);
      }
  }

  private scrollToBottom() {
      setTimeout(() => {
          if (this.messagesEndRef) {
              this.messagesEndRef.scrollTop = this.messagesEndRef.scrollHeight;
          }
      }, 50);
  }

  protected render() {
    const isExpanded = this.state.isExpanded;
    this.element.style.height = isExpanded ? '80vh' : '400px';

    this.element.innerHTML = `
      <div style="padding: 12px 16px; background: #1da1f2; color: white; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center; cursor: pointer;" id="chat-header">
         <div style="display: flex; flex-direction: column;">
            <strong style="font-size: 14px; font-weight: bold; display: flex; align-items: center; gap: 6px;">
               ${escapeHTML(this.props.peerName)} <span style="font-size: 10px; background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 8px;">🔒 E2E</span>
            </strong>
            <span style="font-size: 11px; opacity: 0.9;">via Discover · ${Math.round(this.props.similarity * 100)}% similarity</span>
         </div>
         <div style="display: flex; gap: 12px; align-items: center;">
            <button id="expand-btn" style="background: none; border: none; color: white; cursor: pointer; padding: 0; font-size: 16px; transition: transform 0.2s;" title="Expand">
                ${isExpanded ? '▼' : '▲'}
            </button>
            <button id="close-btn" style="background: none; border: none; color: white; cursor: pointer; padding: 0; font-size: 16px; font-weight: bold;" title="Close">✕</button>
         </div>
      </div>
      <div id="chat-messages" style="flex: 1; padding: 16px; overflow-y: auto; background: #f5f8fa; display: flex; flex-direction: column; gap: 12px;">
      </div>
      <div style="padding: 12px; border-top: 1px solid #e1e8ed; background: white; display: flex; flex-direction: column; gap: 8px;">
         <div style="display: flex; gap: 8px;">
             <input type="text" id="chat-input" placeholder="Type message..." style="flex: 1; padding: 10px 14px; border: 1px solid #e1e8ed; border-radius: 20px; font-size: 14px; outline: none;" autocomplete="off" />
             <button id="chat-send-btn" style="background: #1da1f2; color: white; border: none; width: 40px; height: 40px; border-radius: 20px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(29, 161, 242, 0.2);">
                 <span style="transform: translateY(-1px);">↑</span>
             </button>
         </div>
      </div>
    `;

    this.messagesEndRef = this.element.querySelector('#chat-messages');

    // Header expand toggle
    const header = this.element.querySelector('#chat-header');
    const expandBtn = this.element.querySelector('#expand-btn');
    const toggleExpand = (e: Event) => {
        if ((e.target as HTMLElement).id === 'close-btn') return;
        this.setState({ isExpanded: !this.state.isExpanded });
    };
    if (header) header.addEventListener('click', toggleExpand);

    // Close button
    const closeBtn = this.element.querySelector('#close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            this.props.onClose();
        });
    }

    // Input handlers
    const input = this.element.querySelector('#chat-input') as HTMLInputElement;
    const sendBtn = this.element.querySelector('#chat-send-btn');

    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage(input.value);
            }
        });
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', () => {
            if (input) this.sendMessage(input.value);
        });
    }
  }

  protected update(prevState: ChatPanelState) {
      if (prevState.isExpanded !== this.state.isExpanded) {
          this.element.style.height = this.state.isExpanded ? '80vh' : '400px';
          const expandBtn = this.element.querySelector('#expand-btn');
          if (expandBtn) expandBtn.textContent = this.state.isExpanded ? '▼' : '▲';
      }

      if (prevState.messages !== this.state.messages) {
          const list = this.element.querySelector('#chat-messages');
          if (list) {
              if (this.state.messages.length === 0) {
                  list.innerHTML = '<p style="text-align: center; color: #657786; font-size: 13px; margin-top: 40px;">Say hello! Messages are end-to-end encrypted.</p>';
              } else {
                  list.innerHTML = this.state.messages.map((m, i) => {
                      const prev = i > 0 ? this.state.messages[i-1] : null;
                      const showTime = !prev || (m.timestamp - prev.timestamp > 300000); // 5 mins

                      let timeHtml = '';
                      if (showTime) {
                          const time = new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                          timeHtml = `<div style="text-align: center; font-size: 11px; color: #aab8c2; margin: 8px 0 4px 0;">${time}</div>`;
                      }

                      return `
                        ${timeHtml}
                        <div style="display: flex; flex-direction: column; align-items: ${m.fromMe ? 'flex-end' : 'flex-start'};">
                            <div style="max-width: 80%; padding: 10px 14px; border-radius: 18px; font-size: 14px; line-height: 1.4; ${m.fromMe ? 'background: #1da1f2; color: white; border-bottom-right-radius: 4px;' : 'background: white; color: #14171a; border-bottom-left-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); border: 1px solid #e1e8ed;'}">
                              ${escapeHTML(m.content)}
                            </div>
                        </div>
                      `;
                  }).join('');
              }
              this.scrollToBottom();
          }
      }
  }
}
