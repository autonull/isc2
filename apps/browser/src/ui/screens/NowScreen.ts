import { UIComponent } from '../Component.js';
import { PostItem } from '../components/PostItem.js';

interface NowScreenState {
  posts: any[];
}

export class NowScreen extends UIComponent<any, NowScreenState> {
  private feedSub: any = null;

  constructor(props: any) {
    super('div', props, { posts: [] });
    this.element.className = 'screen now-screen';
    this.element.dataset.testid = 'now-screen';
  }

  protected onMount() {
    const { feedService } = this.props.dependencies || {};
    if (feedService && feedService.subscribe) {
      // Setup live feed updates
      this.feedSub = feedService.subscribe((newPost: any) => {
        // Prepend new posts to the local state
        this.setState({ posts: [newPost, ...this.state.posts] });
      });

      // Initially get any cached or existing feed from history
      // Usually feedService.getPosts() or similar might exist
      if (typeof feedService.getFeed === 'function') {
        const posts = feedService.getFeed('global') || [];
        this.setState({ posts });
      }
    }
  }

  protected onUnmount() {
    if (this.feedSub) {
      this.feedSub(); // Unsubscribe pattern
    }
  }

  protected render() {
    this.element.innerHTML = `
      <div class="channel-header">
        <h2># Global Feed</h2>
        <p>Live posts from your connected peers.</p>
      </div>
      <div class="feed-container" id="feed-container">
        <p class="empty-feed">Loading posts...</p>
      </div>
      <div class="compose-container">
        <textarea id="compose-textarea" placeholder="What's on your mind?"></textarea>
        <button id="compose-btn">Send</button>
      </div>
    `;

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
    // Only update the feed container, leaving compose-textarea alone.
    if (prevState.posts !== this.state.posts) {
      const feedContainer = this.element.querySelector('#feed-container');
      if (!feedContainer) return;

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
        feedContainer.innerHTML = '<p class="empty-feed">No posts yet. Start the conversation!</p>';
      }
    }
  }
}
