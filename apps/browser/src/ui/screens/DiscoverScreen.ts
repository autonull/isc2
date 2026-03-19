import { UIComponent } from '../Component.js';
import { escapeHTML } from '../utils/dom.js';

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

  private async handleConnect(peerId: string) {
    const confirmed = confirm(`Connect with ${peerId}? You will be able to exchange messages directly.`);
    if (confirmed) {
      try {
        const { networkService } = this.props.dependencies || {};
        if (networkService && networkService.connectToPeer) {
          await networkService.connectToPeer(peerId);
          alert(`Connected with ${peerId}!`);
        } else {
          console.warn('[Discover] Connect method not available on network service');
          alert('Connect method not available in current network configuration.');
        }
      } catch (err) {
        console.error('[Discover] Failed to connect:', err);
        alert(`Failed to connect with ${peerId}`);
      }
    }
  }

  private getSimilarityColor(similarity: number): string {
    if (similarity >= 0.7) return '#17bf63';
    if (similarity >= 0.5) return '#1da1f2';
    if (similarity >= 0.3) return '#ffad1f';
    return '#e0245e';
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
      this.state.peers.forEach((match: any) => {
        const peer = match.peer || match; // Handle different match structures
        const peerId = peer.id || 'unknown';
        const similarity = match.similarity || 0;
        const color = this.getSimilarityColor(similarity);
        const pct = Math.round(similarity * 100);

        const div = document.createElement('div');
        div.className = 'peer-card';
        div.style.border = '1px solid #e1e8ed';
        div.style.padding = '16px';
        div.style.marginBottom = '12px';
        div.style.borderRadius = '8px';
        div.style.background = 'white';

        const safeName = escapeHTML(peer.name || peerId.substring(0, 16) + '...');
        const safeDesc = escapeHTML(peer.description || peer.bio || 'No description provided');

        div.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="font-size: 16px;">${safeName}</strong>
            <span style="font-size: 12px; padding: 4px 8px; border-radius: 12px; font-weight: bold; background: ${color}20; color: ${color};">
              ${pct >= 70 ? '🔥' : pct >= 50 ? '✓' : ''} ${pct}% Match
            </span>
          </div>
          <p style="font-size: 14px; color: #657786; margin-bottom: 12px; line-height: 1.5;">
            ${safeDesc}
          </p>
          <button class="peer-chat-btn" data-peer="${escapeHTML(peerId)}" style="padding: 8px 16px; background: #17bf63; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">
            🔗 Connect
          </button>
        `;
        container.appendChild(div);
      });

      // Attach connect handlers
      container.querySelectorAll('.peer-chat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const peerId = (e.currentTarget as HTMLElement).dataset.peer;
          if (peerId) this.handleConnect(peerId);
        });
      });
    }
  }
}
