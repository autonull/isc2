/**
 * Follow Import/Export
 *
 * Social graph portability for migrating connections
 * between platforms.
 *
 * References: NEXT_STEPS.md#93-follow-import-export
 */

import { encode, decode } from '../encoding.js';

/**
 * Social graph export format
 */
export interface SocialGraphExport {
  version: string;
  exportedAt: string;
  user: {
    id: string;
    handle?: string;
  };
  following: SocialConnection[];
  followers?: SocialConnection[];
  metadata: GraphMetadata;
}

/**
 * Social connection
 */
export interface SocialConnection {
  id: string;
  handle?: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  followedAt: string;
  source?: string; // Platform of origin
  metadata?: Record<string, unknown>;
}

/**
 * Graph metadata
 */
export interface GraphMetadata {
  format: 'isc-graph-v1' | 'isc-graph-v1-json' | 'opml' | 'csv';
  totalFollowing: number;
  totalFollowers?: number;
  checksum?: string;
}

/**
 * OPML format for compatibility
 */
export interface OPMLDocument {
  version: string;
  title: string;
  dateCreated: string;
  ownerName?: string;
  outlines: OPMLOutline[];
}

/**
 * OPML outline item
 */
export interface OPMLOutline {
  text: string;
  type?: string;
  xmlUrl?: string;
  htmlUrl?: string;
  outline?: OPMLOutline[];
  [key: string]: unknown;
}

/**
 * CSV row for simple import/export
 */
export interface CSVRow {
  id: string;
  handle?: string;
  displayName?: string;
  followedAt?: string;
  notes?: string;
}

/**
 * Import progress
 */
export interface ImportProgress {
  total: number;
  imported: number;
  failed: number;
  skipped: number;
  current: string;
  status: 'pending' | 'importing' | 'complete' | 'error';
  errors: ImportError[];
}

/**
 * Import error
 */
export interface ImportError {
  item: string;
  reason: string;
  recoverable: boolean;
}

/**
 * Export format version
 */
export const GRAPH_EXPORT_VERSION = 'isc-graph-v1';

/**
 * Create social graph export
 */
export function createSocialGraphExport(
  userId: string,
  following: SocialConnection[],
  options?: {
    handle?: string;
    includeFollowers?: boolean;
    followers?: SocialConnection[];
  }
): SocialGraphExport {
  return {
    version: GRAPH_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    user: {
      id: userId,
      handle: options?.handle,
    },
    following,
    followers: options?.includeFollowers ? options.followers : undefined,
    metadata: {
      format: 'isc-graph-v1-json',
      totalFollowing: following.length,
      totalFollowers: options?.followers?.length,
    },
  };
}

/**
 * Serialize graph to JSON
 */
export function serializeGraph(graph: SocialGraphExport): string {
  return JSON.stringify(graph, null, 2);
}

/**
 * Deserialize graph from JSON
 */
export function deserializeGraph(json: string): SocialGraphExport {
  const data = JSON.parse(json) as SocialGraphExport;

  if (data.version !== GRAPH_EXPORT_VERSION) {
    throw new Error(`Unsupported graph export version: ${data.version}`);
  }

  return data;
}

/**
 * Serialize graph to binary
 */
export function serializeGraphBinary(graph: SocialGraphExport): Uint8Array {
  return encode(graph);
}

/**
 * Deserialize graph from binary
 */
export function deserializeGraphBinary(data: Uint8Array): SocialGraphExport {
  const decoded = decode(data) as SocialGraphExport;

  if (decoded.version !== GRAPH_EXPORT_VERSION) {
    throw new Error(`Unsupported graph export version: ${decoded.version}`);
  }

  return decoded;
}

/**
 * Export to OPML format (for compatibility with RSS readers and other tools)
 */
export function exportToOPML(graph: SocialGraphExport): OPMLDocument {
  const opml: OPMLDocument = {
    version: '2.0',
    title: `${graph.user.handle || graph.user.id}'s Following List`,
    dateCreated: graph.exportedAt,
    ownerName: graph.user.handle,
    outlines: graph.following.map((connection) => ({
      text: connection.displayName || connection.handle || connection.id,
      type: 'rss',
      xmlUrl: connection.metadata?.feedUrl as string | undefined,
      htmlUrl: connection.metadata?.profileUrl as string | undefined,
      'isc:id': connection.id,
      'isc:handle': connection.handle,
      'isc:followedAt': connection.followedAt,
    })),
  };

  return opml;
}

/**
 * Import from OPML format
 */
export function importFromOPML(opml: OPMLDocument, source?: string): SocialGraphExport {
  const following: SocialConnection[] = opml.outlines.map((outline) => ({
    id: (outline['isc:id'] as string) || `opml_${crypto.randomUUID()}`,
    handle: outline['isc:handle'] as string | undefined,
    displayName: outline.text,
    followedAt: (outline['isc:followedAt'] as string) || new Date().toISOString(),
    source,
    metadata: {
      feedUrl: outline.xmlUrl,
      profileUrl: outline.htmlUrl,
    },
  }));

  return {
    version: GRAPH_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    user: {
      id: 'imported',
      handle: opml.ownerName,
    },
    following,
    metadata: {
      format: 'opml',
      totalFollowing: following.length,
    },
  };
}

/**
 * Export to CSV format
 */
export function exportToCSV(graph: SocialGraphExport): string {
  const headers = ['id', 'handle', 'displayName', 'followedAt', 'source'];
  const rows = graph.following.map((connection) => [
    connection.id,
    connection.handle || '',
    connection.displayName || '',
    connection.followedAt,
    connection.source || '',
  ]);

  const csvRows = [headers.join(',')];
  for (const row of rows) {
    csvRows.push(row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','));
  }

  return csvRows.join('\n');
}

/**
 * Import from CSV format
 */
export function importFromCSV(csv: string, source?: string): SocialGraphExport {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have header and at least one data row');
  }

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const following: SocialConnection[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const connection: SocialConnection = {
      id: values[headers.indexOf('id')] || `csv_${crypto.randomUUID()}`,
      handle: values[headers.indexOf('handle')],
      displayName: values[headers.indexOf('displayName')],
      followedAt: values[headers.indexOf('followedAt')] || new Date().toISOString(),
      source: values[headers.indexOf('source')] || source,
    };

    if (connection.id) {
      following.push(connection);
    }
  }

  return {
    version: GRAPH_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    user: {
      id: 'imported',
    },
    following,
    metadata: {
      format: 'csv',
      totalFollowing: following.length,
    },
  };
}

/**
 * Parse CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

/**
 * Find duplicate connections
 */
export function findDuplicates(
  existing: SocialConnection[],
  incomingConnections: SocialConnection[]
): Array<{ existing: SocialConnection; incoming: SocialConnection; matchType: string }> {
  const duplicates: Array<{
    existing: SocialConnection;
    incoming: SocialConnection;
    matchType: string;
  }> = [];

  const existingById = new Map(existing.map((c) => [c.id, c]));
  const existingByHandle = new Map(
    existing.filter((c) => c.handle).map((c) => [c.handle!.toLowerCase(), c])
  );

  for (const connection of incomingConnections) {
    // Check by ID
    const byId = existingById.get(connection.id);
    if (byId) {
      duplicates.push({ existing: byId, incoming: connection, matchType: 'id' });
      continue;
    }

    // Check by handle
    if (connection.handle) {
      const byHandle = existingByHandle.get(connection.handle.toLowerCase());
      if (byHandle) {
        duplicates.push({ existing: byHandle, incoming: connection, matchType: 'handle' });
      }
    }
  }

  return duplicates;
}

/**
 * Merge social graphs
 */
export function mergeSocialGraphs(
  existing: SocialGraphExport,
  incoming: SocialGraphExport,
  options?: {
    skipDuplicates?: boolean;
    updateExisting?: boolean;
  }
): SocialGraphExport {
  const skipDuplicates = options?.skipDuplicates ?? true;
  const updateExisting = options?.updateExisting ?? false;

  const merged: SocialGraphExport = {
    ...existing,
    following: [...existing.following],
    metadata: {
      ...existing.metadata,
      format: 'isc-graph-v1-json',
    },
  };

  const existingIds = new Set(existing.following.map((c) => c.id));
  const existingHandles = new Set(
    existing.following.filter((c) => c.handle).map((c) => c.handle!.toLowerCase())
  );

  for (const connection of incoming.following) {
    const isDuplicate =
      existingIds.has(connection.id) ||
      (connection.handle && existingHandles.has(connection.handle.toLowerCase()));

    if (isDuplicate) {
      if (skipDuplicates) {
        continue;
      }

      if (updateExisting) {
        const index = merged.following.findIndex(
          (c) => c.id === connection.id || (c.handle && c.handle.toLowerCase() === connection.handle?.toLowerCase())
        );
        if (index !== -1) {
          merged.following[index] = { ...merged.following[index], ...connection };
        }
      }
    } else {
      merged.following.push(connection);
    }
  }

  merged.metadata.totalFollowing = merged.following.length;

  return merged;
}

/**
 * Filter connections by source
 */
export function filterConnectionsBySource(
  graph: SocialGraphExport,
  source: string
): SocialGraphExport {
  return {
    ...graph,
    following: graph.following.filter((c) => c.source === source),
    metadata: {
      ...graph.metadata,
      totalFollowing: graph.following.filter((c) => c.source === source).length,
    },
  };
}

/**
 * Sort connections by follow date
 */
export function sortConnectionsByDate(
  graph: SocialGraphExport,
  order: 'ascending' | 'descending' = 'descending'
): SocialGraphExport {
  const sorted = [...graph.following].sort((a, b) => {
    const aDate = new Date(a.followedAt).getTime();
    const bDate = new Date(b.followedAt).getTime();
    return order === 'ascending' ? aDate - bDate : bDate - aDate;
  });

  return {
    ...graph,
    following: sorted,
  };
}

/**
 * Batch import with progress tracking
 */
export async function batchImport(
  connections: SocialConnection[],
  importFn: (connection: SocialConnection) => Promise<boolean>,
  options?: {
    batchSize?: number;
    delayBetweenBatches?: number;
    skipDuplicates?: boolean;
  }
): Promise<ImportProgress> {
  const batchSize = options?.batchSize ?? 10;
  const delayBetweenBatches = options?.delayBetweenBatches ?? 100;
  const skipDuplicates = options?.skipDuplicates ?? true;

  const progress: ImportProgress = {
    total: connections.length,
    imported: 0,
    failed: 0,
    skipped: 0,
    current: '',
    status: 'pending',
    errors: [],
  };

  progress.status = 'importing';

  for (let i = 0; i < connections.length; i += batchSize) {
    const batch = connections.slice(i, i + batchSize);

    for (const connection of batch) {
      progress.current = connection.handle || connection.id;

      try {
        const success = await importFn(connection);

        if (success) {
          progress.imported++;
        } else if (skipDuplicates) {
          progress.skipped++;
        } else {
          progress.failed++;
        }
      } catch (error) {
        progress.failed++;
        progress.errors.push({
          item: connection.id,
          reason: error instanceof Error ? error.message : 'Unknown error',
          recoverable: true,
        });
      }
    }

    // Delay between batches
    if (i + batchSize < connections.length) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
    }
  }

  progress.status = progress.failed === 0 ? 'complete' : 'error';
  return progress;
}

/**
 * Validate social graph export
 */
export function validateGraphExport(graph: SocialGraphExport): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!graph.version) {
    errors.push('Missing version');
  } else if (graph.version !== GRAPH_EXPORT_VERSION) {
    errors.push(`Unsupported version: ${graph.version}`);
  }

  if (!graph.user?.id) {
    errors.push('Missing user ID');
  }

  if (!graph.following || graph.following.length === 0) {
    warnings.push('No connections to import');
  }

  // Validate connections
  for (const connection of graph.following) {
    if (!connection.id) {
      errors.push('Connection missing ID');
    }
    if (!connection.followedAt) {
      warnings.push(`Connection ${connection.id} missing followedAt`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Calculate graph statistics
 */
export function calculateGraphStats(graph: SocialGraphExport): {
  totalFollowing: number;
  totalFollowers: number;
  bySource: Record<string, number>;
  averageFollowDuration: number; // days
  newestFollow: string;
  oldestFollow: string;
} {
  const bySource: Record<string, number> = {};
  let totalDuration = 0;
  let newestFollow = graph.following[0]?.followedAt || '';
  let oldestFollow = graph.following[0]?.followedAt || '';

  const now = Date.now();

  for (const connection of graph.following) {
    // Count by source
    const source = connection.source || 'unknown';
    bySource[source] = (bySource[source] || 0) + 1;

    // Calculate duration
    const followedAt = new Date(connection.followedAt).getTime();
    totalDuration += (now - followedAt) / (1000 * 60 * 60 * 24);

    // Track newest/oldest
    if (!newestFollow || connection.followedAt > newestFollow) {
      newestFollow = connection.followedAt;
    }
    if (!oldestFollow || connection.followedAt < oldestFollow) {
      oldestFollow = connection.followedAt;
    }
  }

  return {
    totalFollowing: graph.following.length,
    totalFollowers: graph.followers?.length || 0,
    bySource,
    averageFollowDuration: graph.following.length > 0 ? totalDuration / graph.following.length : 0,
    newestFollow,
    oldestFollow,
  };
}
