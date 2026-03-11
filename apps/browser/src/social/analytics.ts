/**
 * Analytics & Engagement Tracking Service
 *
 * Tracks post views, engagement metrics, and analytics.
 */

import type { SignedPost } from './types.js';
import { getInteractionCounts } from './interactions.js';

/**
 * Engagement metrics for a post
 */
export interface EngagementMetrics {
  postId: string;
  views: number;
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
  lastUpdated: number;
}

/**
 * Track a view for a post
 */
export async function trackView(postId: string): Promise<void> {
  const db = await getAnalyticsDB();

  const existing = await new Promise<any>((resolve, reject) => {
    const req = db.transaction('views', 'readonly').objectStore('views').get(postId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const now = Date.now();

  if (existing) {
    const lastView = existing.lastView as number;
    if (now - lastView < 60000) {
      return;
    }

    existing.count = (existing.count as number) + 1;
    existing.lastView = now;
    await new Promise<void>((resolve, reject) => {
      const req = db.transaction('views', 'readwrite').objectStore('views').put(existing);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } else {
    await new Promise<void>((resolve, reject) => {
      const req = db.transaction('views', 'readwrite').objectStore('views').put({
        postId,
        count: 1,
        lastView: now,
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

/**
 * Get engagement metrics for a post
 */
export async function getMetrics(postId: string): Promise<EngagementMetrics> {
  const db = await getAnalyticsDB();

  const viewRecord = await new Promise<any>((resolve, reject) => {
    const req = db.transaction('views', 'readonly').objectStore('views').get(postId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const views = viewRecord ? (viewRecord.count as number) : 0;

  const interactions = await getInteractionCounts(postId);

  return {
    postId,
    views,
    likes: interactions.likes,
    reposts: interactions.reposts,
    replies: interactions.replies,
    quotes: interactions.quotes,
    lastUpdated: Date.now(),
  };
}

/**
 * Get aggregate metrics for multiple posts
 */
export async function getAggregateMetrics(postIds: string[]): Promise<Map<string, EngagementMetrics>> {
  const metrics = new Map<string, EngagementMetrics>();

  const results = await Promise.all(postIds.map((id) => getMetrics(id)));
  for (const result of results) {
    metrics.set(result.postId, result);
  }

  return metrics;
}

/**
 * Get top posts by engagement
 */
export async function getTopPostsByEngagement(limit: number = 10): Promise<
  Array<{
    postId: string;
    totalEngagement: number;
    metrics: EngagementMetrics;
  }>
> {
  const db = await getAnalyticsDB();
  const allPosts = await new Promise<SignedPost[]>((resolve, reject) => {
    const req = db.transaction('posts', 'readonly').objectStore('posts').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const scored = await Promise.all(
    allPosts.map(async (post) => {
      const metrics = await getMetrics(post.id);
      const totalEngagement = metrics.likes + metrics.reposts + metrics.replies + metrics.quotes;

      return {
        postId: post.id,
        totalEngagement,
        metrics,
      };
    })
  );

  return scored.sort((a, b) => b.totalEngagement - a.totalEngagement).slice(0, limit);
}

/**
 * Get top posts by views
 */
export async function getTopPostsByViews(limit: number = 10): Promise<
  Array<{
    postId: string;
    views: number;
    metrics: EngagementMetrics;
  }>
> {
  const db = await getAnalyticsDB();
  const views = await new Promise<any[]>((resolve, reject) => {
    const req = db.transaction('views', 'readonly').objectStore('views').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const sorted = views.sort((a, b) => b.count - a.count);

  const results = await Promise.all(
    sorted.slice(0, limit).map(async (v: { postId: string }) => {
      const metrics = await getMetrics(v.postId);
      return {
        postId: v.postId,
        views: metrics.views,
        metrics,
      };
    })
  );

  return results;
}

/**
 * Track impression (post shown in feed)
 */
export async function trackImpression(postId: string, position: number): Promise<void> {
  const db = await getAnalyticsDB();

  await new Promise<void>((resolve, reject) => {
    const req = db.transaction('impressions', 'readwrite').objectStore('impressions').put({
      postId,
      position,
      timestamp: Date.now(),
    });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get click-through rate for a post
 */
export async function getCTR(postId: string): Promise<number> {
  const db = await getAnalyticsDB();

  const impressions = await new Promise<any[]>((resolve, reject) => {
    const req = db.transaction('impressions', 'readonly').objectStore('impressions').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const impressionCount = impressions.filter((i) => i.postId === postId).length;

  const viewRecord = await new Promise<any>((resolve, reject) => {
    const req = db.transaction('views', 'readonly').objectStore('views').get(postId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const viewCount = viewRecord ? (viewRecord.count as number) : 0;

  if (impressionCount === 0) return 0;

  return viewCount / impressionCount;
}

/**
 * Get user engagement summary
 */
export async function getUserEngagementSummary(peerID: string): Promise<{
  totalPosts: number;
  totalViews: number;
  totalLikes: number;
  totalReposts: number;
  totalReplies: number;
  avgEngagementRate: number;
}> {
  const { getPostsByAuthor } = await import('./posts.js');
  const posts = await getPostsByAuthor(peerID);

  const metrics = await getAggregateMetrics(posts.map((p) => p.id));

  let totalViews = 0;
  let totalLikes = 0;
  let totalReposts = 0;
  let totalReplies = 0;

  for (const [, m] of metrics) {
    totalViews += m.views;
    totalLikes += m.likes;
    totalReposts += m.reposts;
    totalReplies += m.replies;
  }

  const totalEngagement = totalLikes + totalReposts + totalReplies;
  const avgEngagementRate = posts.length > 0 ? totalEngagement / posts.length : 0;

  return {
    totalPosts: posts.length,
    totalViews,
    totalLikes,
    totalReposts,
    totalReplies,
    avgEngagementRate,
  };
}

/**
 * Clear old analytics data (older than specified days)
 */
export async function clearOldAnalytics(days: number = 30): Promise<void> {
  const db = await getAnalyticsDB();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const impressions = await new Promise<any[]>((resolve, reject) => {
    const req = db.transaction('impressions', 'readonly').objectStore('impressions').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  for (const imp of impressions) {
    if ((imp.timestamp as number) < cutoff) {
      await new Promise<void>((resolve, reject) => {
        const req = db.transaction('impressions', 'readwrite').objectStore('impressions').delete(imp.postId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  }
}

/**
 * Register a post for analytics tracking
 */
export async function registerPost(post: SignedPost): Promise<void> {
  const db = await getAnalyticsDB();
  await new Promise<void>((resolve, reject) => {
    const req = db.transaction('posts', 'readwrite').objectStore('posts').put(post);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ============================================================================
// Database Helpers
// ============================================================================

async function getAnalyticsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('isc-analytics', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('views')) {
        db.createObjectStore('views', { keyPath: 'postId' });
      }
      if (!db.objectStoreNames.contains('impressions')) {
        db.createObjectStore('impressions', { keyPath: ['postId', 'timestamp'] });
      }
      if (!db.objectStoreNames.contains('posts')) {
        db.createObjectStore('posts', { keyPath: 'id' });
      }
    };
  });
}
