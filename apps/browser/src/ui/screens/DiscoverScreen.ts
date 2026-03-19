import { UIComponent } from '../Component.js';
import { escapeHTML } from '../utils/dom.js';

import { SemanticMapView } from '../components/SemanticMapView.js';
import { ChatPanel } from '../components/ChatPanel.js';

interface DiscoverState {
  peers: any[];
  discovering: boolean;
  status: string;
  viewMode: 'list' | 'map';
  activeChatPeer: any | null;
}

export class DiscoverScreen extends UIComponent<any, DiscoverState> {
  private networkSub: any = null;

  constructor(props: any) {
    super('div', props, { peers: [], discovering: false, status: 'disconnected', viewMode: 'list', activeChatPeer: null });
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
        <div style="display: flex; gap: 8px; align-items: center;">
            <div style="display: flex; background: #e1e8ed; border-radius: 6px; padding: 2px;">
               <button id="view-list-btn" style="padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px; ${this.state.viewMode === 'list' ? 'background: white; color: #14171a; box-shadow: 0 1px 2px rgba(0,0,0,0.1);' : 'background: transparent; color: #657786;'}">List</button>
               <button id="view-map-btn" style="padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px; ${this.state.viewMode === 'map' ? 'background: white; color: #14171a; box-shadow: 0 1px 2px rgba(0,0,0,0.1);' : 'background: transparent; color: #657786;'}">Map</button>
            </div>
            <button id="refresh-peers-btn" style="padding: 8px 16px; background: #1da1f2; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Discover</button>
        </div>
      </div>
      <div id="discover-content" style="flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column;">
        <div class="peer-list" id="peer-list-container" style="flex: 1; display: ${this.state.viewMode === 'list' ? 'block' : 'none'};"></div>
        <div id="map-container" style="flex: 1; display: ${this.state.viewMode === 'map' ? 'block' : 'none'};"></div>
      </div>
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

    const listBtn = this.element.querySelector('#view-list-btn');
    if (listBtn) {
        listBtn.addEventListener('click', () => this.setState({ viewMode: 'list' }));
    }

    const mapBtn = this.element.querySelector('#view-map-btn');
    if (mapBtn) {
        mapBtn.addEventListener('click', () => this.setState({ viewMode: 'map' }));
    }
  }

  private async handleConnect(peerId: string) {
    const peer = this.state.peers.find((p: any) => p.peer.id === peerId || p.id === peerId);
    if (!peer) return;

    // Instead of a confirm box, open the chat overlay
    this.setState({ activeChatPeer: peer });

    try {
        const { networkService } = this.props.dependencies || {};
        if (networkService && networkService.connectToPeer) {
            await networkService.connectToPeer(peerId);
        }
    } catch (err) {
        console.error('[Discover] Failed to connect to peer for chat:', err);
    }
  }

  private getSimilarityColor(similarity: number): string {
    if (similarity >= 0.7) return '#17bf63';
    if (similarity >= 0.5) return '#1da1f2';
    if (similarity >= 0.3) return '#ffad1f';
    return '#e0245e';
  }

  protected update(prevState: DiscoverState) {
    if (prevState.viewMode !== this.state.viewMode) {
        const listContainer = this.element.querySelector('#peer-list-container') as HTMLElement;
        const mapContainer = this.element.querySelector('#map-container') as HTMLElement;

        if (listContainer && mapContainer) {
            listContainer.style.display = this.state.viewMode === 'list' ? 'block' : 'none';
            mapContainer.style.display = this.state.viewMode === 'map' ? 'block' : 'none';
        }

        const listBtn = this.element.querySelector('#view-list-btn') as HTMLElement;
        const mapBtn = this.element.querySelector('#view-map-btn') as HTMLElement;

        if (listBtn && mapBtn) {
            listBtn.style.background = this.state.viewMode === 'list' ? 'white' : 'transparent';
            listBtn.style.color = this.state.viewMode === 'list' ? '#14171a' : '#657786';
            listBtn.style.boxShadow = this.state.viewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none';

            mapBtn.style.background = this.state.viewMode === 'map' ? 'white' : 'transparent';
            mapBtn.style.color = this.state.viewMode === 'map' ? '#14171a' : '#657786';
            mapBtn.style.boxShadow = this.state.viewMode === 'map' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none';
        }
    }

    if (prevState.activeChatPeer !== this.state.activeChatPeer) {
        if (this.state.activeChatPeer) {
            let chatPanel = this.children.get('chat-panel') as ChatPanel;
            const targetPeer = this.state.activeChatPeer.peer || this.state.activeChatPeer;

            if (!chatPanel) {
                chatPanel = new ChatPanel({
                   peerId: targetPeer.id,
                   peerName: targetPeer.name || targetPeer.id.substring(0, 8),
                   similarity: this.state.activeChatPeer.similarity || 0,
                   dependencies: this.props.dependencies,
                   onClose: () => this.setState({ activeChatPeer: null })
                });
                this.appendChildComponent('chat-panel', chatPanel, this.element);
            } else {
                chatPanel.setProps({
                   peerId: targetPeer.id,
                   peerName: targetPeer.name || targetPeer.id.substring(0, 8),
                   similarity: this.state.activeChatPeer.similarity || 0
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

    // Update map view component
    if (this.state.viewMode === 'map') {
        let mapView = this.children.get('semantic-map') as SemanticMapView;
        if (!mapView) {
            mapView = new SemanticMapView({
               points: this.state.peers,
               onPeerClick: (id) => this.handleConnect(id)
            });
            this.appendChildComponent('semantic-map', mapView, '#map-container');
        } else {
            mapView.setProps({ points: this.state.peers });
        }
    }

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
