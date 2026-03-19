import { UIComponent } from '../Component.js';

export class PostItem extends UIComponent<any, any> {
  constructor(props: any) {
    super('div', props);
    this.element.className = 'post-item';
    this.element.dataset.testid = 'post-item';
  }

  protected render() {
    const { post } = this.props;
    if (!post) return;

    // Simple robust HTML escaping instead of bringing in DOMPurify just yet
    const escapeHTML = (str: string) => str.replace(/[&<>'"]/g,
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );

    const author = escapeHTML(post.author || 'Anonymous');
    const content = escapeHTML(post.content || '');
    const time = new Date(post.timestamp).toLocaleTimeString();

    this.element.innerHTML = `
      <div class="post-header">
        <span class="post-author">${author}</span>
        <span class="post-time">${time}</span>
      </div>
      <div class="post-content">${content}</div>
    `;
  }
}
