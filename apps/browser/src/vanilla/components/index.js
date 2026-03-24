/**
 * Components Index
 *
 * Unified component exports for the vanilla UI.
 * Use these components instead of raw DOM manipulation or template strings.
 *
 * API:
 * - render(props) → HTMLElement
 * - mount(el, props) → cleanup function
 * - update(el, props) → void
 */

// Core utility
export {
  el,
  escapeHtml,
  find,
  delegate,
  render,
  clear,
  toggleClass,
  setAttrs,
  isMobile,
} from '../utils/dom.js';

// Re-export from utils/component.js (legacy, being deprecated)
export {
  Button,
  Badge,
  Select,
  Input,
  Textarea,
  Card,
  EmptyState,
  Spinner,
  Modal,
  Toast,
  List,
  Grid,
} from '../utils/component.js';

// New component library
export { Avatar, mountAvatar, updateAvatar } from './Avatar.js';

export { CharCounter, bindCharCounter } from './CharCounter.js';

export { PeerCard, mountPeerCard } from './PeerCard.js';

export { PostCard, mountPostCard } from './PostCard.js';

export { ComposeBar, mountComposeBar } from './ComposeBar.js';

export { FeedHeader, mountFeedHeader } from './FeedHeader.js';

export { ViewMode, mountViewMode } from './ViewMode.js';

export {
  PostList,
  renderPostCard,
  renderPostBody,
  renderPostActions,
  renderReplyPost,
  renderListPosts,
  renderGridPosts,
  renderSpaceView,
} from './PostList.js';

export {
  EmptyState,
  renderEmptyState,
  createNoPostsState,
  createNoNeighborsState,
  createNoChannelsState,
  createOfflineState,
} from './EmptyState.js';

// Re-export modal (enhanced version)
export { modals } from './modal.js';

// Re-export sidebar
export { createSidebar } from './sidebar.js';

// Re-export channelDrawer
export { createChannelDrawer } from './channelDrawer.js';

// Re-export neighbors (component)
export { NeighborsComponent } from './neighbors.js';

// Re-export splash
export { createSplash } from './splash.js';

// Re-export chatPanel
export { ChatPanel } from './chatPanel.js';

// Re-export conversationList
export { ConversationList } from './conversationList.js';

// Re-export channelEdit
export { openChannelEdit } from './channelEdit.js';

// Re-export mixerPanel
export { MixerPanel } from './mixerPanel.js';

// Re-export videoCallOverlay
export { VideoCallOverlay } from './videoCallOverlay.js';

/**
 * @typedef {Object} ComponentModule
 * @property {Function} render - Create element from props
 * @property {Function} [mount] - Mount with events, returns cleanup
 * @property {Function} [update] - Update element with new props
 */

/**
 * @typedef {Object} ScreenModule
 * @property {Function} render - Render screen HTML
 * @property {Function} [bind] - Bind events to container
 * @property {Function} [update] - Update screen (diff-friendly)
 * @property {Function} [destroy] - Cleanup on screen exit
 */
