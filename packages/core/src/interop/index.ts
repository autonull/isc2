/**
 * Interoperability Module
 *
 * Cross-platform compatibility and data portability.
 */

// AT Protocol Bridge
export {
  ATProtocolClient,
  RecordTypes,
  parseATUri,
  buildATUri,
  isValidHandle,
  isValidDID,
  extractMentions,
  extractHashtags,
  createEnrichedPost,
  ATRateLimiter,
  type ATSession,
  type ATProtocolConfig,
  type ATRecord,
  type RecordValue,
  type ATPostRecord,
  type ATProfileRecord,
  type ATFollowRecord,
  type ATLikeRecord,
  type ATRepostRecord,
} from './at-protocol.js';

// Data Portability
export {
  createDataExport,
  serializeExport,
  deserializeExport,
  serializeExportBinary,
  deserializeExportBinary,
  calculateExportChecksum,
  verifyExportChecksum,
  importData,
  filterExportByDate,
  filterExportByType,
  createExportSummary,
  validateExport,
  mergeExports,
  splitExport,
  EXPORT_VERSION,
  type DataExport,
  type UserExport,
  type ContentExport,
  type PostExport,
  type CommentExport,
  type MediaExport,
  type ConnectionsExport,
  type ConnectionExport,
  type SettingsExport,
  type ExportMetadata,
  type ImportResult,
  type ImportError,
} from './data-portability.js';

// Follow Portability
export {
  createSocialGraphExport,
  serializeGraph,
  deserializeGraph,
  serializeGraphBinary,
  deserializeGraphBinary,
  exportToOPML,
  importFromOPML,
  exportToCSV,
  importFromCSV,
  findDuplicates,
  mergeSocialGraphs,
  filterConnectionsBySource,
  sortConnectionsByDate,
  batchImport,
  validateGraphExport,
  calculateGraphStats,
  GRAPH_EXPORT_VERSION,
  type SocialGraphExport,
  type SocialConnection,
  type GraphMetadata,
  type OPMLDocument,
  type OPMLOutline,
  type CSVRow,
  type ImportProgress,
} from './follow-portability.js';
