import { UIComponent } from '../Component.js';
import { PostItem } from '../components/PostItem.js';

interface NowScreenState {
  posts: any[];
  networkStatus: string;
  loading: boolean;
}

export class NowScreen extends UIComponent<any, NowScreenState> {
  private feedSub: any = null;
  private networkSub: any = null;

  constructor(props: any) {
    super('div', props, { posts: [], networkStatus: 'disconnected', loading: true });
    this.element.className = 'screen now-screen';
    this.element.dataset.testid = 'now-screen';
  }

  protected onMount() {
    const { feedService, networkService } = this.props.dependencies || {};

    if (networkService) {
      this.setState({ networkStatus: networkService.getStatus ? networkService.getStatus() : 'disconnected' });
      if (networkService.on) {
        this.networkSub = networkService.on('onStatusChange', (status: string) => {
          this.setState({ networkStatus: status });
        });
      }

      // Load initial posts if available
      const netPosts = networkService.getPosts ? networkService.getPosts() : [];
      this.setState({ posts: netPosts, loading: false });
    }
    if (feedService && feedService.subscribe) {
      // Setup live feed updates
      this.feedSub = feedService.subscribe((newPost: any) => {
        // Prepend new posts to the local state
        // Try to avoid duplicates
        if (!this.state.posts.find(p => p.id === newPost.id)) {
          this.setState({ posts: [newPost, ...this.state.posts] });
        }
      });

      // Initially get any cached or existing feed from history
      // Usually feedService.getPosts() or similar might exist
      if (typeof feedService.getFeed === 'function') {
        const localPosts = feedService.getFeed('global') || [];
        const combined = [...this.state.posts, ...localPosts].sort(
           (a, b) => ((b as any).createdAt || (b as any).timestamp || 0) - ((a as any).createdAt || (a as any).timestamp || 0)
        );

        // remove duplicates by ID
        const unique = Array.from(new Map(combined.map(item => [item.id || item.hash, item])).values());
        this.setState({ posts: unique, loading: false });
      }
    }

    if (!feedService && !networkService) {
        this.setState({ loading: false });
    }
  }

  protected onUnmount() {
    if (this.feedSub) {
      this.feedSub(); // Unsubscribe pattern
    }
    if (this.networkSub) {
      this.networkSub();
    }
  }

  protected render() {
    this.element.innerHTML = `
      <div class="channel-header" style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #e1e8ed; background: white; position: sticky; top: 0; z-index: 100;">
        <div>
          <h2 style="font-size: 20px; font-weight: bold; margin: 0; color: #14171a;">🏠 Now</h2>
          <div class="network-status-indicator" id="network-status-indicator" style="font-size: 12px; margin-top: 4px; color: #657786;"></div>
        </div>
        <div style="display: flex; gap: 12px; align-items: center;">
          <button id="refresh-btn" style="background: none; border: none; cursor: pointer; font-size: 20px;" title="Refresh">🔄</button>
        </div>
      </div>
      <div class="feed-container" id="feed-container">
        <p class="empty-feed" id="loading-state">Loading posts...</p>
      </div>
      <div class="compose-container">
        <textarea id="compose-textarea" placeholder="What's on your mind?"></textarea>
        <button id="compose-btn">Send</button>
      </div>
    `;

    // Attach refresh handler
    const refreshBtn = this.element.querySelector('#refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        this.setState({ loading: true });

        const { feedService, networkService } = this.props.dependencies || {};

        let newPosts: any[] = [];

        if (networkService) {
           newPosts = networkService.getPosts ? networkService.getPosts() : [];
        }

        if (feedService) {
            // Wait a small bit for feedService to fetch latest if it's async (or assume sync)
            if (feedService.refresh) {
                await feedService.refresh('global');
            }
            const localPosts = feedService.getFeed ? feedService.getFeed('global') : [];
            newPosts = [...newPosts, ...(localPosts || [])];
        }

        const combined = newPosts.sort(
           (a, b) => ((b as any).createdAt || (b as any).timestamp || 0) - ((a as any).createdAt || (a as any).timestamp || 0)
        );
        const unique = Array.from(new Map(combined.map(item => [item.id || item.hash, item])).values());

        this.setState({ posts: unique, loading: false });
      });
    }

    // Attach compose handler once
    const btn = this.element.querySelector('#compose-btn');
    const textarea = this.element.querySelector('#compose-textarea') as HTMLTextAreaElement;
    if (btn && textarea) {
      btn.addEventListener('click', async () => {
        const val = textarea.value.trim();
        if (!val) return;

        try {
          const { postService } = this.props.dependencies || {};
          if (postService) {
            // Send the actual post
            await postService.createPost('global', val);
            textarea.value = ''; // clear only on success
          } else {
            console.warn('[NowScreen] PostService unavailable');
          }
        } catch (e) {
          console.error('[NowScreen] Failed to post', e);
          alert('Failed to post. Check console.');
        }
      });
    }
  }

  protected update(prevState: NowScreenState) {
    const statusIndicator = this.element.querySelector('#network-status-indicator');
    if (statusIndicator) {
       const isConnected = this.state.networkStatus === 'connected';
       statusIndicator.innerHTML = `Status: <strong style="color: ${isConnected ? '#17bf63' : '#d93025'}">${this.state.networkStatus}</strong>`;
    }

    // Only update the feed container, leaving compose-textarea alone.
    if (prevState.posts !== this.state.posts || prevState.loading !== this.state.loading) {
      const feedContainer = this.element.querySelector('#feed-container');
      if (!feedContainer) return;

      if (this.state.loading) {
        feedContainer.innerHTML = '<p class="empty-feed" id="loading-state">Loading posts...</p>';
        return;
      }

      if (this.state.posts.length > 0) {
        // To preserve children state gracefully, we could diff or prepend.
        // For now, we clear the specific feed container (not the whole screen) and rebuild posts.
        feedContainer.innerHTML = '';
        this.state.posts.forEach(post => {
          const idStr = post.id || post.hash || Math.random().toString();
          // Avoid re-mounting if we already have it
          if (!this.children.has('post-' + idStr)) {
            const postComponent = new PostItem({ post });
            this.appendChildComponent('post-' + idStr, postComponent, '#feed-container');
          } else {
            // If already exists, just make sure its element is inside feedContainer in correct order
            const existing = this.children.get('post-' + idStr);
            if (existing) feedContainer.appendChild(existing.getElement());
          }
        });
      } else {
        feedContainer.innerHTML = `
            <div class="empty-state" data-testid="now-empty-state" style="text-align: center; padding: 60px 20px; color: #657786;">
              <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
              <h3 style="margin: 0 0 8px 0; font-size: 18px;">No posts yet</h3>
              <p style="margin: 0; font-size: 14px;">
                Create a channel and start posting to see content here.
              </p>
            </div>

            <div class="card" style="background: #e8f4fd; border-radius: 12px; padding: 20px; margin-top: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" data-testid="now-how-it-works">
              <h4 style="margin: 0 0 10px 0; color: #1da1f2;">💡 How Now Works</h4>
              <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #657786; line-height: 1.8;">
                <li>Create channels to define topics of interest</li>
                <li>Posts are semantically matched to your channels</li>
                <li>Your feed shows posts from all channels</li>
                <li>Discover new peers with similar interests</li>
              </ul>
            </div>
        `;
      }
    }
  }
}
