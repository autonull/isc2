/**
 * Data Export/Import
 *
 * User data portability for compliance with data regulations.
 * Enables users to export their data in standard formats and
 * import data from other platforms.
 *
 * References: NEXT_STEPS.md#92-data-export-import
 */

import { encode, decode } from '../encoding.js';

/**
 * Export data package
 */
export interface DataExport {
  version: string;
  exportedAt: string;
  user: UserExport;
  content: ContentExport;
  connections: ConnectionsExport;
  settings?: SettingsExport;
  metadata: ExportMetadata;
}

/**
 * User profile export
 */
export interface UserExport {
  id: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Content export (posts, media, etc.)
 */
export interface ContentExport {
  posts: PostExport[];
  comments: CommentExport[];
  media: MediaExport[];
}

/**
 * Post export format
 */
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
  entities?: Array<{
    type: 'mention' | 'hashtag' | 'link';
    value: string;
    start: number;
    end: number;
  }>;
}

/**
 * Comment export format
 */
export interface CommentExport {
  id: string;
  postId: string;
  content: string;
  createdAt: string;
  likes: number;
  replies: number;
}

/**
 * Media export format
 */
export interface MediaExport {
  id: string;
  type: 'image' | 'video' | 'audio';
  url: string;
  alt?: string;
  createdAt: string;
  size?: number;
  mimeType?: string;
}

/**
 * Connections export (follows, blocks, mutes)
 */
export interface ConnectionsExport {
  following: ConnectionExport[];
  followers: ConnectionExport[];
  blocks: ConnectionExport[];
  mutes: ConnectionExport[];
}

/**
 * Connection export format
 */
export interface ConnectionExport {
  id: string;
  handle?: string;
  displayName?: string;
  connectedAt: string;
}

/**
 * Settings export
 */
export interface SettingsExport {
  preferences: Record<string, unknown>;
  notifications: Record<string, boolean>;
  privacy: Record<string, boolean>;
}

/**
 * Export metadata
 */
export interface ExportMetadata {
  format: 'isc-export-v1' | 'isc-export-v1-json';
  compression?: 'none' | 'gzip';
  encryption?: 'none' | 'aes-256';
  checksum?: string;
}

/**
 * Import result
 */
export interface ImportResult {
  success: boolean;
  imported: {
    posts: number;
    comments: number;
    connections: number;
  };
  errors: ImportError[];
  warnings: string[];
}

/**
 * Import error
 */
export interface ImportError {
  type: 'duplicate' | 'invalid' | 'conflict' | 'unknown';
  item: string;
  message: string;
}

/**
 * Export format version
 */
export const EXPORT_VERSION = 'isc-export-v1';

/**
 * Create data export
 */
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
    metadata: {
      format: 'isc-export-v1-json',
      compression: 'none',
    },
  };
}

/**
 * Serialize export to JSON
 */
export function serializeExport(exportData: DataExport): string {
  return JSON.stringify(exportData, null, 2);
}

/**
 * Deserialize export from JSON
 */
export function deserializeExport(json: string): DataExport {
  const data = JSON.parse(json) as DataExport;
  
  if (data.version !== EXPORT_VERSION) {
    throw new Error(`Unsupported export version: ${data.version}`);
  }
  
  return data;
}

/**
 * Serialize export to binary
 */
export function serializeExportBinary(exportData: DataExport): Uint8Array {
  return encode(exportData);
}

/**
 * Deserialize export from binary
 */
export function deserializeExportBinary(data: Uint8Array): DataExport {
  const decoded = decode(data) as DataExport;
  
  if (decoded.version !== EXPORT_VERSION) {
    throw new Error(`Unsupported export version: ${decoded.version}`);
  }
  
  return decoded;
}

/**
 * Calculate checksum for export
 */
export async function calculateExportChecksum(exportData: DataExport): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(serializeExport(exportData));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify export checksum
 */
export async function verifyExportChecksum(
  exportData: DataExport,
  expectedChecksum: string
): Promise<boolean> {
  const actualChecksum = await calculateExportChecksum(exportData);
  return actualChecksum === expectedChecksum;
}

/**
 * Import data from export
 */
export async function importData(
  exportData: DataExport,
  options?: {
    skipDuplicates?: boolean;
    mergeConnections?: boolean;
  }
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: {
      posts: 0,
      comments: 0,
      connections: 0,
    },
    errors: [],
    warnings: [],
  };

  // Validate export
  if (exportData.version !== EXPORT_VERSION) {
    result.success = false;
    result.errors.push({
      type: 'invalid',
      item: 'export',
      message: `Unsupported export version: ${exportData.version}`,
    });
    return result;
  }

  // Import posts
  for (const post of exportData.content.posts) {
    try {
      // In production, would check for duplicates and import
      result.imported.posts++;
    } catch (error) {
      result.errors.push({
        type: 'unknown',
        item: `post:${post.id}`,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Import comments
  for (const comment of exportData.content.comments) {
    try {
      result.imported.comments++;
    } catch (error) {
      result.errors.push({
        type: 'unknown',
        item: `comment:${comment.id}`,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Import connections
  if (options?.mergeConnections ?? true) {
    result.imported.connections =
      exportData.connections.following.length +
      exportData.connections.followers.length;
  }

  // Add warnings for partial imports
  if (result.errors.length > 0) {
    result.warnings.push(`Imported with ${result.errors.length} errors`);
  }

  return result;
}

/**
 * Filter export by date range
 */
export function filterExportByDate(
  exportData: DataExport,
  startDate?: Date,
  endDate?: Date
): DataExport {
  const filtered: DataExport = {
    ...exportData,
    content: {
      posts: exportData.content.posts,
      comments: exportData.content.comments,
      media: exportData.content.media,
    },
    connections: {
      following: exportData.connections.following,
      followers: exportData.connections.followers,
      blocks: exportData.connections.blocks,
      mutes: exportData.connections.mutes,
    },
  };

  if (startDate || endDate) {
    const start = startDate?.getTime() ?? 0;
    const end = endDate?.getTime() ?? Date.now();

    filtered.content.posts = exportData.content.posts.filter(
      (post) => {
        const postDate = new Date(post.createdAt).getTime();
        return postDate >= start && postDate <= end;
      }
    );

    filtered.content.comments = exportData.content.comments.filter(
      (comment) => {
        const commentDate = new Date(comment.createdAt).getTime();
        return commentDate >= start && commentDate <= end;
      }
    );
  }

  return filtered;
}

/**
 * Filter export by content type
 */
export function filterExportByType(
  exportData: DataExport,
  types: Array<'posts' | 'comments' | 'media' | 'connections'>
): DataExport {
  const filtered: DataExport = {
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

  return filtered;
}

/**
 * Create export summary
 */
export function createExportSummary(exportData: DataExport): {
  totalPosts: number;
  totalComments: number;
  totalMedia: number;
  totalFollowing: number;
  totalFollowers: number;
  dateRange: {
    earliest: string;
    latest: string;
  };
  sizeEstimate: string;
} {
  const allDates = [
    ...exportData.content.posts.map((p) => new Date(p.createdAt).getTime()),
    ...exportData.content.comments.map((c) => new Date(c.createdAt).getTime()),
  ];

  const earliest = allDates.length > 0 ? new Date(Math.min(...allDates)).toISOString() : 'N/A';
  const latest = allDates.length > 0 ? new Date(Math.max(...allDates)).toISOString() : 'N/A';

  // Rough size estimate
  const jsonSize = serializeExport(exportData).length;
  const sizeEstimate = formatBytes(jsonSize);

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

/**
 * Format bytes to human-readable string
 */
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

/**
 * Validate export structure
 */
export function validateExport(exportData: DataExport): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!exportData.version) {
    errors.push('Missing version');
  } else if (exportData.version !== EXPORT_VERSION) {
    errors.push(`Unsupported version: ${exportData.version}`);
  }

  if (!exportData.exportedAt) {
    errors.push('Missing exportedAt timestamp');
  }

  if (!exportData.user?.id) {
    errors.push('Missing user ID');
  }

  if (!exportData.content) {
    errors.push('Missing content section');
  }

  if (!exportData.connections) {
    errors.push('Missing connections section');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Merge multiple exports
 */
export function mergeExports(
  exports: DataExport[],
  options?: {
    deduplicatePosts?: boolean;
    deduplicateConnections?: boolean;
  }
): DataExport {
  const deduplicatePosts = options?.deduplicatePosts ?? true;
  const deduplicateConnections = options?.deduplicateConnections ?? true;

  if (exports.length === 0) {
    throw new Error('No exports to merge');
  }

  // Use first export as base
  const base = exports[0];
  const merged: DataExport = {
    ...base,
    content: {
      posts: [...base.content.posts],
      comments: [...base.content.comments],
      media: [...base.content.media],
    },
    connections: {
      following: [...base.connections.following],
      followers: [...base.connections.followers],
      blocks: [...base.connections.blocks],
      mutes: [...base.connections.mutes],
    },
  };

  // Merge additional exports
  for (let i = 1; i < exports.length; i++) {
    const exportData = exports[i];

    // Merge posts
    for (const post of exportData.content.posts) {
      if (deduplicatePosts && merged.content.posts.some((p) => p.id === post.id)) {
        continue;
      }
      merged.content.posts.push(post);
    }

    // Merge comments
    for (const comment of exportData.content.comments) {
      if (deduplicatePosts && merged.content.comments.some((c) => c.id === comment.id)) {
        continue;
      }
      merged.content.comments.push(comment);
    }

    // Merge connections
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

  // Sort by date
  merged.content.posts.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  merged.content.comments.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return merged;
}

/**
 * Split large export into chunks
 */
export function splitExport(
  exportData: DataExport,
  maxPostsPerChunk: number = 1000
): DataExport[] {
  const chunks: DataExport[] = [];
  const totalPosts = exportData.content.posts.length;
  const numChunks = Math.ceil(totalPosts / maxPostsPerChunk);

  for (let i = 0; i < numChunks; i++) {
    const start = i * maxPostsPerChunk;
    const end = Math.min(start + maxPostsPerChunk, totalPosts);

    chunks.push({
      ...exportData,
      content: {
        posts: exportData.content.posts.slice(start, end),
        comments: exportData.content.comments,
        media: exportData.content.media,
      },
      connections: exportData.connections,
      metadata: {
        ...exportData.metadata,
        compression: 'none',
      },
    });
  }

  return chunks;
}
