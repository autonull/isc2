import { UIComponent } from '../Component.js';
import { escapeHTML } from '../utils/dom.js';

export class PostItem extends UIComponent<any, any> {
  constructor(props: any) {
    super('div', props);
    this.element.className = 'post-item';
    this.element.dataset.testid = 'post-item';
  }

  protected render() {
    const { post } = this.props;
    if (!post) return;

    const author = escapeHTML(post.author ? post.author.slice(0, 16) + '...' : 'Anonymous');
    let content = escapeHTML(post.content || '');

    // Calculate time offset
    const hours = Math.floor((Date.now() - post.timestamp) / (1000 * 60 * 60));
    let timeStr = 'Just now';
    if (hours >= 24) timeStr = new Date(post.timestamp).toLocaleDateString();
    else if (hours >= 1) timeStr = `${hours}h ago`;

    // Handle file attachments format [FILE:hash]
    const fileMatch = post.content?.match(/\[FILE:([a-f0-9]+)\]/);
    if (fileMatch) {
      content = content.replace(/\[FILE:[a-f0-9]+\]/g, ''); // strip the raw tag
      content += `
        <a href="#file:${fileMatch[1]}" class="file-download-link" data-hash="${fileMatch[1]}" data-testid="file-download-link" style="display: inline-flex; align-items: center; gap: 4px; color: #1da1f2; text-decoration: none; padding: 4px 8px; background: #e8f4fd; border-radius: 4px; font-size: 13px; margin-left: 8px;">
          📎 Download Attachment
        </a>
      `;
    }

    this.element.style.padding = '12px 16px';
    this.element.style.borderBottom = '1px solid #e1e8ed';

    this.element.innerHTML = `
      <div class="post-header" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span class="post-author" style="font-weight: bold; font-size: 14px;">${author}</span>
        <span class="post-time" style="color: #657786; font-size: 12px;">${timeStr}</span>
      </div>
      <div class="post-content" style="font-size: 15px; line-height: 1.5; margin-bottom: 12px;">${content}</div>
      <div class="post-actions" style="display: flex; gap: 24px;">
        <button class="action-btn action-like" style="background: none; border: none; cursor: pointer; font-size: 14px; color: #657786; padding: 4px 0;">♥ 0</button>
        <button class="action-btn action-repost" style="background: none; border: none; cursor: pointer; font-size: 14px; color: #657786; padding: 4px 0;">⟳ 0</button>
        <button class="action-btn action-reply" style="background: none; border: none; cursor: pointer; font-size: 14px; color: #657786; padding: 4px 0;">💬 0</button>
      </div>
    `;

    // Bind basic events (Like/Repost/Reply stubs for now to match UI parity)
    const likeBtn = this.element.querySelector('.action-like');
    likeBtn?.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      target.style.color = '#e0245e';
      target.innerText = '♥ 1';
      target.style.pointerEvents = 'none';
    });

    const dlLink = this.element.querySelector('.file-download-link');
    dlLink?.addEventListener('click', (e) => {
      e.preventDefault();
      const hash = (e.currentTarget as HTMLElement).dataset.hash;
      alert(`Download file requested: ${hash}\n(Network routing skipped in Vanilla demo)`);
    });
  }
}
