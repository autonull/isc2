import { UIComponent } from '../Component.js';

interface DiscoverState {
  peers: any[];
  discovering: boolean;
}

export class DiscoverScreen extends UIComponent<any, DiscoverState> {
  constructor(props: any) {
    super('div', props, { peers: [], discovering: false });
    this.element.className = 'screen discover-screen';
    this.element.dataset.testid = 'discover-screen';
  }

  protected async onMount() {
    const { discovery } = this.props.dependencies || {};
    if (discovery) {
      this.setState({ discovering: true });
      try {
        const peers = await discovery.discoverPeers();
        this.setState({ peers, discovering: false });
      } catch (err) {
        console.error('Failed to discover peers:', err);
        this.setState({ discovering: false });
      }
    }
  }

  protected render() {
    this.element.innerHTML = `
      <div class="channel-header">
        <h2>@ Discover Peers</h2>
        <p>Find other users with similar interests via the DHT.</p>
        <button id="refresh-peers-btn">Refresh</button>
      </div>
      <div class="peer-list" id="peer-list-container"></div>
    `;

    const btn = this.element.querySelector('#refresh-peers-btn');
    if (btn) {
      btn.addEventListener('click', () => this.onMount());
    }
  }

  protected update() {
    const container = this.element.querySelector('#peer-list-container');
    if (!container) return;

    if (this.state.discovering) {
      container.innerHTML = '<p>Searching for peers in the DHT...</p>';
    } else if (this.state.peers.length === 0) {
      container.innerHTML = '<p>No peers found nearby.</p>';
    } else {
      container.innerHTML = '';
      this.state.peers.forEach((peer: any) => {
        const div = document.createElement('div');
        div.className = 'peer-card';
        div.innerHTML = `
          <div class="peer-info">
            <strong>${peer.id.substring(0, 8)}...</strong>
            <p>Score: ${peer.score?.toFixed(2) || 'N/A'}</p>
          </div>
          <button class="peer-chat-btn" data-peer="${peer.id}">Chat</button>
        `;
        container.appendChild(div);
      });

      // Attach chat handlers
      container.querySelectorAll('.peer-chat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const peerId = (e.target as HTMLElement).dataset.peer;
          alert('Chat with ' + peerId + ' (Not fully wired in Vanilla yet)');
        });
      });
    }
  }
}
