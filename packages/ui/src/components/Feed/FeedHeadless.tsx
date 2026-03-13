/**
 * FeedHeadless Component
 *
 * Headless feed component that separates logic from presentation.
 */

import { h, JSX } from 'preact';
import type { SignedPost } from '@isc/core';
import { useFeedLogic, type UseFeedLogicOptions, type UseFeedLogicReturn } from '../../hooks/useFeedLogic.js';

/**
 * Feed headless props
 */
export interface FeedHeadlessProps extends UseFeedLogicOptions {
  children: (props: UseFeedLogicReturn & { renderPost: (post: SignedPost) => JSX.Element }) => JSX.Element;
  renderPost: (post: SignedPost) => JSX.Element;
  renderLoading?: () => JSX.Element;
  renderError?: (error: string) => JSX.Element;
  renderEmpty?: () => JSX.Element;
}

/**
 * Default loading component
 */
function Loading(): JSX.Element {
  return h('div', { class: 'feed-loading', role: 'status' }, 'Loading...');
}

/**
 * Default error component
 */
function Error({ message }: { message: string }): JSX.Element {
  return h('div', { class: 'feed-error', role: 'alert' }, message);
}

/**
 * Default empty component
 */
function Empty(): JSX.Element {
  return h('div', { class: 'feed-empty' }, 'No posts yet');
}

/**
 * Feed headless component
 */
export function FeedHeadless({
  children,
  renderPost,
  renderLoading,
  renderError,
  renderEmpty,
  ...options
}: FeedHeadlessProps): JSX.Element {
  const feed = useFeedLogic(options);

  if (feed.loading) {
    return renderLoading?.() ?? h(Loading, {});
  }

  if (feed.error) {
    return renderError?.(feed.error) ?? h(Error, { message: feed.error });
  }

  if (feed.posts.length === 0) {
    return renderEmpty?.() ?? h(Empty, {});
  }

  return children({ ...feed, renderPost });
}
