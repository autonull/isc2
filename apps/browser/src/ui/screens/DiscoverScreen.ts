import { UIComponent } from '../Component.js';
import { escapeHTML } from '../utils/dom.js';

interface DiscoverState {
  peers: any[];
  discovering: boolean;
  status: string;
}

export class DiscoverScreen extends UIComponent<any, DiscoverState> {
  private networkSub: any = null;

  constructor(props: any) {
    super('div', props, { peers: [], discovering: false, status: 'disconnected' });
    this.element.className = 'screen discover-screen';
    this.element.dataset.testid = 'discover-screen';
  }

  protected async onMount() {
    const { networkService } = this.props.dependencies || {};
    if (networkService) {
      this.setState({
         status: networkService.getStatus ? networkService.getStatus() : 'disconnected',
         peers: networkService.getMatches ? networkService.getMatches() : []
      });

      if (networkService.on) {
        this.networkSub = networkService.on('onStatusChange', (status: string) => {
          this.setState({ status });
        });

        // Also listen for match updates if they have such an event
        networkService.on('onMatchesUpdated', (peers: any[]) => {
           this.setState({ peers: [...peers] });
        });
      }
    }
  }

  protected onUnmount() {
      if (this.networkSub) {
          this.networkSub();
      }
  }

  protected render() {
    this.element.innerHTML = `
      <div class="channel-header" style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #e1e8ed; background: white;">
        <div>
          <h2 style="font-size: 20px; font-weight: bold; margin: 0; color: #14171a;">@ Discover Peers</h2>
          <p style="font-size: 14px; color: #657786; margin: 4px 0 0 0;">Find other users with similar interests via the DHT.</p>
        </div>
        <button id="refresh-peers-btn" style="padding: 8px 16px; background: #1da1f2; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Discover</button>
      </div>
      <div class="peer-list" id="peer-list-container" style="flex: 1; padding: 20px; overflow-y: auto;"></div>
    `;

    const btn = this.element.querySelector('#refresh-peers-btn');
    if (btn) {
      btn.addEventListener('click', async () => {
          if (this.state.discovering) return;
          this.setState({ discovering: true });
          try {
             const { networkService } = this.props.dependencies || {};
             if (networkService && networkService.discoverPeers) {
                 const peers = await networkService.discoverPeers();
                 this.setState({ peers, discovering: false });
             } else {
                 this.setState({ discovering: false });
             }
          } catch (e) {
             console.error('[Discover] Failed', e);
             this.setState({ discovering: false });
          }
      });
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
      container.innerHTML = '<div style="text-align: center; padding: 40px 20px; color: #657786;">Searching for peers in the DHT...</div>';
    } else if (this.state.peers.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: #657786;">
          <div style="font-size: 48px; margin-bottom: 16px;">📡</div>
          <h3 style="margin: 0 0 8px 0; font-size: 18px;">No peers found nearby</h3>
          <p style="margin: 0; font-size: 14px;">Try clicking discover to search the network.</p>
        </div>
      `;
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

        let topicsHtml = '';
        if (peer.topics && Array.isArray(peer.topics)) {
            topicsHtml = '<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;">' +
                peer.topics.map((t: string) => `<span style="font-size: 12px; padding: 4px 10px; background: #e8f4fd; color: #1da1f2; border-radius: 12px;">${escapeHTML(t)}</span>`).join('') +
                '</div>';
        }

        div.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="font-size: 16px; color: #14171a;">${safeName}</strong>
            <span style="font-size: 12px; padding: 4px 8px; border-radius: 12px; font-weight: bold; background: ${color}20; color: ${color};">
              ${pct >= 70 ? '🔥' : pct >= 50 ? '✓' : ''} ${pct}% Match
            </span>
          </div>
          <p style="font-size: 14px; color: #657786; margin-bottom: 12px; line-height: 1.5;">
            ${safeDesc}
          </p>
          ${topicsHtml}
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
