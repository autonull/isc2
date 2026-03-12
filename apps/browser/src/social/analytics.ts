import type { SignedPost } from './types.js';
import { getInteractionCounts } from './interactions.js';
import { openDB, dbGet, dbGetAll, dbPut } from '@isc/adapters';

const DB_NAME = 'isc-analytics';
const DB_VERSION = 1;

let analyticsDb: IDBDatabase | null = null;

async function getAnalyticsDB(): Promise<IDBDatabase> {
  if (analyticsDb) return analyticsDb;

  analyticsDb = await openDB(DB_NAME, DB_VERSION, (db) => {
    if (!db.objectStoreNames.contains('views')) {
      db.createObjectStore('views', { keyPath: 'postId' });
    }
    if (!db.objectStoreNames.contains('impressions')) {
      db.createObjectStore('impressions', { keyPath: ['postId', 'timestamp'] });
    }
    if (!db.objectStoreNames.contains('posts')) {
      db.createObjectStore('posts', { keyPath: 'id' });
    }
  });

  return analyticsDb;
}

export interface EngagementMetrics {
  postId: string;
  views: number;
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
  lastUpdated: number;
}

interface ViewRecord {
  postId: string;
  count: number;
  lastView: number;
}

export async function trackView(postId: string): Promise<void> {
  const db = await getAnalyticsDB();
  const existing = await dbGet<ViewRecord>(db, 'views', postId);
  const now = Date.now();

  if (existing) {
    if (now - existing.lastView < 60000) return;
    existing.count += 1;
    existing.lastView = now;
    await dbPut(db, 'views', existing);
  } else {
    await dbPut(db, 'views', { postId, count: 1, lastView: now });
  }
}

export async function getMetrics(postId: string): Promise<EngagementMetrics> {
  const db = await getAnalyticsDB();
  const viewRecord = await dbGet<ViewRecord>(db, 'views', postId);
  const views = viewRecord?.count ?? 0;
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

export async function getAggregateMetrics(
  postIds: string[]
): Promise<Map<string, EngagementMetrics>> {
  const metrics = new Map<string, EngagementMetrics>();
  const results = await Promise.all(postIds.map((id) => getMetrics(id)));
  for (const result of results) {
    metrics.set(result.postId, result);
  }
  return metrics;
}

export async function getTopPostsByEngagement(limit: number = 10): Promise<
  Array<{ postId: string; totalEngagement: number; metrics: EngagementMetrics }>
> {
  const db = await getAnalyticsDB();
  const allPosts = await dbGetAll<SignedPost>(db, 'posts');

  const scored = await Promise.all(
    allPosts.map(async (post) => {
      const metrics = await getMetrics(post.id);
      const totalEngagement = metrics.likes + metrics.reposts + metrics.replies + metrics.quotes;
      return { postId: post.id, totalEngagement, metrics };
    })
  );

  return scored.sort((a, b) => b.totalEngagement - a.totalEngagement).slice(0, limit);
}

export async function getTopPostsByViews(limit: number = 10): Promise<
  Array<{ postId: string; views: number; metrics: EngagementMetrics }>
> {
  const db = await getAnalyticsDB();
  const views = await dbGetAll<ViewRecord>(db, 'views');
  const sorted = views.sort((a, b) => b.count - a.count);

  const results = await Promise.all(
    sorted.slice(0, limit).map(async (v) => {
      const metrics = await getMetrics(v.postId);
      return { postId: v.postId, views: metrics.views, metrics };
    })
  );

  return results;
}

export async function trackImpression(postId: string, position: number): Promise<void> {
  const db = await getAnalyticsDB();
  await dbPut(db, 'impressions', { postId, position, timestamp: Date.now() });
}

export async function getCTR(postId: string): Promise<number> {
  const db = await getAnalyticsDB();
  const impressions = await dbGetAll<{ postId: string }>(db, 'impressions');
  const impressionCount = impressions.filter((i) => i.postId === postId).length;
  const viewRecord = await dbGet<ViewRecord>(db, 'views', postId);
  const viewCount = viewRecord?.count ?? 0;
  return impressionCount > 0 ? viewCount / impressionCount : 0;
}

export async function getUserEngagementSummary(userId: string): Promise<{
  totalPosts: number;
  totalViews: number;
  totalLikes: number;
  totalReposts: number;
  totalReplies: number;
  avgEngagementRate: number;
}> {
  const db = await getAnalyticsDB();
  const allPosts = await dbGetAll<SignedPost>(db, 'posts');
  const userPosts = allPosts.filter((p) => p.author === userId);
  const metrics = await Promise.all(userPosts.map((p) => getMetrics(p.id)));

  const totalViews = metrics.reduce((sum, m) => sum + m.views, 0);
  const totalLikes = metrics.reduce((sum, m) => sum + m.likes, 0);
  const totalReposts = metrics.reduce((sum, m) => sum + m.reposts, 0);
  const totalReplies = metrics.reduce((sum, m) => sum + m.replies, 0);
  const totalEngagement = totalLikes + totalReposts + totalReplies;
  const avgEngagementRate = totalViews > 0 ? totalEngagement / totalViews : 0;

  return {
    totalPosts: userPosts.length,
    totalViews,
    totalLikes,
    totalReposts,
    totalReplies,
    avgEngagementRate,
  };
}

export async function registerPost(post: SignedPost): Promise<void> {
  const db = await getAnalyticsDB();
  await dbPut(db, 'posts', post);
}

export async function clearOldAnalytics(days: number = 30): Promise<void> {
  const db = await getAnalyticsDB();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const impressions = await dbGetAll<{ postId: string; timestamp: number }>(db, 'impressions');
  const oldImpressions = impressions.filter((i) => i.timestamp < cutoff);
  if (oldImpressions.length === 0) return;

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('impressions', 'readwrite');
    for (const impression of oldImpressions) {
      tx.objectStore('impressions').delete([impression.postId, impression.timestamp]);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
