import { encode, decode } from '../encoding.js';

export interface DataExport {
  version: string;
  exportedAt: string;
  user: UserExport;
  content: ContentExport;
  connections: ConnectionsExport;
  settings?: SettingsExport;
  metadata: ExportMetadata;
}

export interface UserExport {
  id: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContentExport {
  posts: PostExport[];
  comments: CommentExport[];
  media: MediaExport[];
}

export interface PostExport {
  id: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  channel?: string;
  likes: number;
  reposts: number;
  replies: number;
  language?: string;
  entities?: Array<{ type: 'mention' | 'hashtag' | 'link'; value: string; start: number; end: number }>;
}

export interface CommentExport {
  id: string;
  postId: string;
  content: string;
  createdAt: string;
  likes: number;
  replies: number;
}

export interface MediaExport {
  id: string;
  type: 'image' | 'video' | 'audio';
  url: string;
  alt?: string;
  createdAt: string;
  size?: number;
  mimeType?: string;
}

export interface ConnectionsExport {
  following: ConnectionExport[];
  followers: ConnectionExport[];
  blocks: ConnectionExport[];
  mutes: ConnectionExport[];
}

export interface ConnectionExport {
  id: string;
  handle?: string;
  displayName?: string;
  connectedAt: string;
}

export interface SettingsExport {
  preferences: Record<string, unknown>;
  notifications: Record<string, boolean>;
  privacy: Record<string, boolean>;
}

export interface ExportMetadata {
  format: 'isc-export-v1' | 'isc-export-v1-json';
  compression?: 'none' | 'gzip';
  encryption?: 'none' | 'aes-256';
  checksum?: string;
}

export interface ImportResult {
  success: boolean;
  imported: { posts: number; comments: number; connections: number };
  errors: ImportError[];
  warnings: string[];
}

export interface ImportError {
  type: 'duplicate' | 'invalid' | 'conflict' | 'unknown';
  item: string;
  message: string;
}

export const EXPORT_VERSION = 'isc-export-v1';

export function createDataExport(
  user: UserExport,
  content: ContentExport,
  connections: ConnectionsExport,
  settings?: SettingsExport
): DataExport {
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    user,
    content,
    connections,
    settings,
    metadata: { format: 'isc-export-v1-json', compression: 'none' },
  };
}

export function serializeExport(exportData: DataExport): string {
  return JSON.stringify(exportData, null, 2);
}

export function deserializeExport(json: string): DataExport {
  const data = JSON.parse(json) as DataExport;
  if (data.version !== EXPORT_VERSION) {
    throw new Error(`Unsupported export version: ${data.version}`);
  }
  return data;
}

export function serializeExportBinary(exportData: DataExport): Uint8Array {
  return encode(exportData);
}

export function deserializeExportBinary(data: Uint8Array): DataExport {
  const decoded = decode(data) as DataExport;
  if (decoded.version !== EXPORT_VERSION) {
    throw new Error(`Unsupported export version: ${decoded.version}`);
  }
  return decoded;
}

export async function calculateExportChecksum(exportData: DataExport): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(serializeExport(exportData));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyExportChecksum(exportData: DataExport, expectedChecksum: string): Promise<boolean> {
  const actualChecksum = await calculateExportChecksum(exportData);
  return actualChecksum === expectedChecksum;
}

export async function importData(
  exportData: DataExport,
  options?: { skipDuplicates?: boolean; mergeConnections?: boolean }
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: { posts: 0, comments: 0, connections: 0 },
    errors: [],
    warnings: [],
  };

  if (exportData.version !== EXPORT_VERSION) {
    result.success = false;
    result.errors.push({ type: 'invalid', item: 'export', message: `Unsupported export version: ${exportData.version}` });
    return result;
  }

  for (const post of exportData.content.posts) {
    try {
      result.imported.posts++;
    } catch (error) {
      result.errors.push({ type: 'unknown', item: `post:${post.id}`, message: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  for (const comment of exportData.content.comments) {
    try {
      result.imported.comments++;
    } catch (error) {
      result.errors.push({ type: 'unknown', item: `comment:${comment.id}`, message: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  if (options?.mergeConnections ?? true) {
    result.imported.connections = exportData.connections.following.length + exportData.connections.followers.length;
  }

  if (result.errors.length > 0) {
    result.warnings.push(`Imported with ${result.errors.length} errors`);
  }

  return result;
}

export function filterExportByDate(exportData: DataExport, startDate?: Date, endDate?: Date): DataExport {
  const filtered: DataExport = {
    ...exportData,
    content: { posts: exportData.content.posts, comments: exportData.content.comments, media: exportData.content.media },
    connections: { following: exportData.connections.following, followers: exportData.connections.followers, blocks: exportData.connections.blocks, mutes: exportData.connections.mutes },
  };

  if (startDate || endDate) {
    const start = startDate?.getTime() ?? 0;
    const end = endDate?.getTime() ?? Date.now();

    filtered.content.posts = exportData.content.posts.filter((post) => {
      const postDate = new Date(post.createdAt).getTime();
      return postDate >= start && postDate <= end;
    });

    filtered.content.comments = exportData.content.comments.filter((comment) => {
      const commentDate = new Date(comment.createdAt).getTime();
      return commentDate >= start && commentDate <= end;
    });
  }

  return filtered;
}

export function filterExportByType(
  exportData: DataExport,
  types: Array<'posts' | 'comments' | 'media' | 'connections'>
): DataExport {
  return {
    ...exportData,
    content: {
      posts: types.includes('posts') ? exportData.content.posts : [],
      comments: types.includes('comments') ? exportData.content.comments : [],
      media: types.includes('media') ? exportData.content.media : [],
    },
    connections: {
      following: types.includes('connections') ? exportData.connections.following : [],
      followers: types.includes('connections') ? exportData.connections.followers : [],
      blocks: types.includes('connections') ? exportData.connections.blocks : [],
      mutes: types.includes('connections') ? exportData.connections.mutes : [],
    },
  };
}

export function createExportSummary(exportData: DataExport): {
  totalPosts: number;
  totalComments: number;
  totalMedia: number;
  totalFollowing: number;
  totalFollowers: number;
  dateRange: { earliest: string; latest: string };
  sizeEstimate: string;
} {
  const allDates = [
    ...exportData.content.posts.map((p) => new Date(p.createdAt).getTime()),
    ...exportData.content.comments.map((c) => new Date(c.createdAt).getTime()),
  ];

  const earliest = allDates.length > 0 ? new Date(Math.min(...allDates)).toISOString() : 'N/A';
  const latest = allDates.length > 0 ? new Date(Math.max(...allDates)).toISOString() : 'N/A';
  const sizeEstimate = formatBytes(serializeExport(exportData).length);

  return {
    totalPosts: exportData.content.posts.length,
    totalComments: exportData.content.comments.length,
    totalMedia: exportData.content.media.length,
    totalFollowing: exportData.connections.following.length,
    totalFollowers: exportData.connections.followers.length,
    dateRange: { earliest, latest },
    sizeEstimate,
  };
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function validateExport(exportData: DataExport): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!exportData.version) errors.push('Missing version');
  else if (exportData.version !== EXPORT_VERSION) errors.push(`Unsupported version: ${exportData.version}`);
  if (!exportData.exportedAt) errors.push('Missing exportedAt timestamp');
  if (!exportData.user?.id) errors.push('Missing user ID');
  if (!exportData.content) errors.push('Missing content section');
  if (!exportData.connections) errors.push('Missing connections section');
  return { valid: errors.length === 0, errors };
}

export function mergeExports(
  exports: DataExport[],
  options?: { deduplicatePosts?: boolean; deduplicateConnections?: boolean }
): DataExport {
  const deduplicatePosts = options?.deduplicatePosts ?? true;
  const deduplicateConnections = options?.deduplicateConnections ?? true;

  if (exports.length === 0) throw new Error('No exports to merge');

  const base = exports[0];
  const merged: DataExport = {
    ...base,
    content: { posts: [...base.content.posts], comments: [...base.content.comments], media: [...base.content.media] },
    connections: { following: [...base.connections.following], followers: [...base.connections.followers], blocks: [...base.connections.blocks], mutes: [...base.connections.mutes] },
  };

  for (let i = 1; i < exports.length; i++) {
    const exportData = exports[i];

    for (const post of exportData.content.posts) {
      if (deduplicatePosts && merged.content.posts.some((p) => p.id === post.id)) continue;
      merged.content.posts.push(post);
    }

    for (const comment of exportData.content.comments) {
      if (deduplicatePosts && merged.content.comments.some((c) => c.id === comment.id)) continue;
      merged.content.comments.push(comment);
    }

    if (deduplicateConnections) {
      const followingIds = new Set(merged.connections.following.map((f) => f.id));
      for (const following of exportData.connections.following) {
        if (!followingIds.has(following.id)) {
          merged.connections.following.push(following);
          followingIds.add(following.id);
        }
      }
    } else {
      merged.connections.following.push(...exportData.connections.following);
    }
  }

  merged.content.posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  merged.content.comments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return merged;
}

export function splitExport(exportData: DataExport, maxPostsPerChunk: number = 1000): DataExport[] {
  const chunks: DataExport[] = [];
  const totalPosts = exportData.content.posts.length;
  const numChunks = Math.ceil(totalPosts / maxPostsPerChunk);

  for (let i = 0; i < numChunks; i++) {
    const start = i * maxPostsPerChunk;
    const end = Math.min(start + maxPostsPerChunk, totalPosts);

    chunks.push({
      ...exportData,
      content: { posts: exportData.content.posts.slice(start, end), comments: exportData.content.comments, media: exportData.content.media },
      connections: exportData.connections,
      metadata: { ...exportData.metadata, compression: 'none' },
    });
  }

  return chunks;
}
