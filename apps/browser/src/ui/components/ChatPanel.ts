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

  private loadMessages() {
     const stored = localStorage.getItem(`isc-messages-${this.props.peerId}`);
     if (stored) {
         try {
             this.setState({ messages: JSON.parse(stored) });
             this.scrollToBottom();
         } catch (e) {}
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
      localStorage.setItem(`isc-messages-${this.props.peerId}`, JSON.stringify(updatedMessages));
      this.scrollToBottom();

      try {
        const { chat } = this.props.dependencies || {};
        if (chat && chat.send) {
          await chat.send(this.props.peerId, content);
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
            <strong style="font-size: 14px;">${escapeHTML(this.props.peerName)}</strong>
            <span style="font-size: 11px; opacity: 0.8;">Similarity: ${Math.round(this.props.similarity * 100)}%</span>
         </div>
         <div style="display: flex; gap: 12px; align-items: center;">
            <button id="expand-btn" style="background: none; border: none; color: white; cursor: pointer; padding: 0; font-size: 16px;" title="Expand">
                ${isExpanded ? '▼' : '▲'}
            </button>
            <button id="close-btn" style="background: none; border: none; color: white; cursor: pointer; padding: 0; font-size: 16px;" title="Close">✕</button>
         </div>
      </div>
      <div id="chat-messages" style="flex: 1; padding: 16px; overflow-y: auto; background: #f5f8fa; display: flex; flex-direction: column; gap: 12px;">
      </div>
      <div style="padding: 12px; border-top: 1px solid #e1e8ed; background: white; display: flex; gap: 8px;">
         <input type="text" id="chat-input" placeholder="Message..." style="flex: 1; padding: 8px 12px; border: 1px solid #e1e8ed; border-radius: 16px; font-size: 13px; outline: none;" />
         <button id="chat-send-btn" style="background: #1da1f2; color: white; border: none; padding: 8px 16px; border-radius: 16px; font-weight: bold; cursor: pointer; font-size: 13px;">Send</button>
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
                  list.innerHTML = '<p style="text-align: center; color: #657786; font-size: 13px; margin-top: 40px;">Say hello!</p>';
              } else {
                  list.innerHTML = this.state.messages.map(m => `
                    <div style="display: flex; flex-direction: column; align-items: ${m.fromMe ? 'flex-end' : 'flex-start'};">
                        <div style="max-width: 80%; padding: 8px 12px; border-radius: 14px; font-size: 13px; line-height: 1.4; ${m.fromMe ? 'background: #1da1f2; color: white; border-bottom-right-radius: 4px;' : 'background: white; color: #14171a; border-bottom-left-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);'}">
                          ${escapeHTML(m.content)}
                        </div>
                    </div>
                  `).join('');
              }
              this.scrollToBottom();
          }
      }
  }
}
