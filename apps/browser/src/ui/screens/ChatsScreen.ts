import { UIComponent } from '../Component.js';

interface ChatsState {
  chats: any[];
}

export class ChatsScreen extends UIComponent<any, ChatsState> {
  constructor(props: any) {
    super('div', props, { chats: [] });
    this.element.className = 'screen chats-screen';
  }

  protected async onMount() {
    const { chat } = this.props.dependencies || {};
    if (chat && chat.getChats) {
      try {
        const chats = await chat.getChats();
        this.setState({ chats });
      } catch (e) {
        console.warn('Failed to load chats', e);
      }
    }
  }

  protected render() {
    this.element.innerHTML = `
      <div class="channel-header">
        <h2>✉ Private Chats</h2>
        <p>End-to-end encrypted direct messages.</p>
      </div>
      <div class="chats-list" id="chats-container"></div>
    `;
  }

  protected update() {
    const container = this.element.querySelector('#chats-container');
    if (!container) return;

    if (this.state.chats.length === 0) {
      container.innerHTML = '<p>No active chats. Start one from Discover!</p>';
    } else {
      container.innerHTML = '';
      this.state.chats.forEach(c => {
        const chatEl = document.createElement('div');
        chatEl.className = 'chat-card';
        chatEl.innerHTML = `<strong>${c.peerId}</strong><p>Last active: ${new Date(c.lastActive).toLocaleDateString()}</p>`;
        container.appendChild(chatEl);
      });
    }
  }
}
