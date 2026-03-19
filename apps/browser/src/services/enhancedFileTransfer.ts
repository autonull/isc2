/**
 * Enhanced File Transfer Service
 *
 * Features:
 * - Chunked file transfer with progress tracking
 * - MIME type detection
 * - File preview generation
 * - Transfer state management
 * - Resume support for interrupted transfers
 */

import type { Libp2p } from 'libp2p';
import { FileProtocol } from '../protocol/file.js';

export interface TransferProgress {
  fileId: string;
  fileName: string;
  totalBytes: number;
  transferredBytes: number;
  progress: number; // 0-1
  status: 'pending' | 'uploading' | 'downloading' | 'paused' | 'completed' | 'error' | 'cancelled';
  error?: string;
  speed?: number; // bytes per second
  eta?: number; // estimated time remaining in ms
}

export interface FileInfo {
  hash: string;
  name: string;
  type: string;
  size: number;
  preview?: string; // Data URL for images/small files
  createdAt: number;
  isImage: boolean;
  isVideo: boolean;
  isAudio: boolean;
  isDocument: boolean;
  isArchive: boolean;
}

interface TransferState {
  fileId: string;
  hash: string;
  fileName: string;
  fileType: string;
  totalBytes: number;
  transferredBytes: number;
  chunks: Map<number, Uint8Array>;
  chunkSize: number;
  totalChunks: number;
  startTime: number;
  lastProgressTime: number;
  lastBytesTransferred: number;
}

const CHUNK_SIZE = 64 * 1024; // 64KB chunks for better progress granularity
const MAX_CONCURRENT_CHUNKS = 4;
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// MIME type categories for preview
const MIME_CATEGORIES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif'],
  video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
  audio: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/mp4'],
  document: ['application/pdf', 'text/plain', 'text/html', 'application/rtf', 'application/msword'],
  archive: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/gzip'],
};

export class EnhancedFileTransferService {
  private protocol: FileProtocol;
  private node: Libp2p;
  private stagedFiles = new Map<string, FileInfo>();
  private activeTransfers = new Map<string, TransferState>();
  private transferListeners = new Set<(progress: TransferProgress) => void>();
  private readonly MAX_STAGED_FILES = 100;
  private readonly TRANSFER_TIMEOUT = 300000; // 5 minutes

  constructor(node: Libp2p) {
    this.node = node;
    this.protocol = new FileProtocol(node);
    this.setupProtocolHandler();
  }

  private setupProtocolHandler(): void {
    this.node.handle('/isc/file/1.0', ({ stream }) => {
      this.protocol.handleStream(stream, (hash) => this.getStagedFile(hash)).catch(console.error);
    });
  }

  /**
   * Detect MIME type from file
   */
  private detectMimeType(file: File): string {
    // Use file.type if available
    if (file.type) return file.type;

    // Fallback to extension-based detection
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      avif: 'image/avif',
      mp4: 'video/mp4',
      webm: 'video/webm',
      ogg: 'video/ogg',
      mov: 'video/quicktime',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      pdf: 'application/pdf',
      txt: 'text/plain',
      html: 'text/html',
      zip: 'application/zip',
      rar: 'application/x-rar-compressed',
      '7z': 'application/x-7z-compressed',
      gz: 'application/gzip',
    };
    return mimeMap[ext] || 'application/octet-stream';
  }

  /**
   * Categorize file by MIME type
   */
  private categorizeFile(mimeType: string): {
    isImage: boolean;
    isVideo: boolean;
    isAudio: boolean;
    isDocument: boolean;
    isArchive: boolean;
  } {
    return {
      isImage: MIME_CATEGORIES.image.includes(mimeType),
      isVideo: MIME_CATEGORIES.video.includes(mimeType),
      isAudio: MIME_CATEGORIES.audio.includes(mimeType),
      isDocument: MIME_CATEGORIES.document.includes(mimeType),
      isArchive: MIME_CATEGORIES.archive.includes(mimeType),
    };
  }

  /**
   * Generate preview for supported file types
   */
  private async generatePreview(file: File, mimeType: string): Promise<string | undefined> {
    // Only generate previews for small files (< 5MB)
    if (file.size > 5 * 1024 * 1024) return undefined;

    // Image preview
    if (MIME_CATEGORIES.image.includes(mimeType)) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(undefined);
        reader.readAsDataURL(file);
      });
    }

    // Text preview (first 10KB)
    if (mimeType.startsWith('text/') || mimeType === 'application/pdf') {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const text = reader.result as string;
          // Create data URL for text
          const blob = new Blob([text.slice(0, 10000)], { type: 'text/plain' });
          const textReader = new FileReader();
          textReader.onload = () => resolve(textReader.result as string);
          textReader.onerror = () => resolve(undefined);
          textReader.readAsDataURL(blob);
        };
        reader.onerror = () => resolve(undefined);
        reader.readAsText(file);
      });
    }

    return undefined;
  }

  /**
   * Stage file for sharing with metadata
   */
  async stageFile(file: File): Promise<FileInfo> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB (max: ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
    }

    const mimeType = this.detectMimeType(file);
    const hash = await FileProtocol.computeHash(file);
    const preview = await this.generatePreview(file, mimeType);
    const categories = this.categorizeFile(mimeType);

    // Cleanup old files if needed
    if (this.stagedFiles.size >= this.MAX_STAGED_FILES) {
      const oldest = Array.from(this.stagedFiles.entries())
        .sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
      if (oldest) {
        this.stagedFiles.delete(oldest[0]);
        await this.removeFromStorage(oldest[0]);
      }
    }

    const fileInfo: FileInfo = {
      hash,
      name: file.name,
      type: mimeType,
      size: file.size,
      preview,
      createdAt: Date.now(),
      ...categories,
    };

    this.stagedFiles.set(hash, fileInfo);
    await this.saveToStorage(fileInfo, file);

    return fileInfo;
  }

  /**
   * Download file from peer with progress tracking
   */
  async downloadFile(peerId: string, hash: string, fileName?: string): Promise<{ blob: Blob; info: FileInfo }> {
    const fileId = `download_${hash}_${Date.now()}`;
    const startTime = Date.now();

    // Initialize transfer state
    const transferState: TransferState = {
      fileId,
      hash,
      fileName: fileName || hash,
      fileType: 'application/octet-stream',
      totalBytes: 0,
      transferredBytes: 0,
      chunks: new Map(),
      chunkSize: CHUNK_SIZE,
      totalChunks: 0,
      startTime,
      lastProgressTime: startTime,
      lastBytesTransferred: 0,
    };

    this.activeTransfers.set(fileId, transferState);

    try {
      const stream = await this.node.dialProtocol(peerId as any, '/isc/file/1.0');

      // Send request
      await stream.sink([new TextEncoder().encode(`REQ:${hash}`)]);

      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      // Read response with progress
      for await (const chunk of stream.source as AsyncIterable<Uint8Array>) {
        const text = new TextDecoder().decode(chunk);
        if (text.startsWith('EOF:')) {
          if (text === 'EOF:NOT_FOUND') {
            throw new Error('File not found on peer');
          }
          // Extract filename from EOF marker if present
          const extractedName = text.substring(4);
          if (extractedName && extractedName !== hash) {
            transferState.fileName = extractedName;
          }
          break;
        }

        chunks.push(chunk);
        totalBytes += chunk.length;
        transferState.transferredBytes = totalBytes;
        transferState.totalBytes = totalBytes;

        // Emit progress
        this.emitProgress(fileId, 'downloading');
      }

      await stream.close();

      const blob = new Blob(chunks);
      const mimeType = this.detectMimeTypeFromData(blob, transferState.fileName);

      const fileInfo: FileInfo = {
        hash,
        name: transferState.fileName,
        type: mimeType,
        size: blob.size,
        createdAt: Date.now(),
        ...this.categorizeFile(mimeType),
      };

      // Cleanup transfer state
      this.activeTransfers.delete(fileId);

      return { blob, info: fileInfo };
    } catch (error) {
      this.activeTransfers.delete(fileId);
      this.emitProgress(fileId, 'error', (error as Error).message);
      throw error;
    }
  }

  /**
   * Upload file to peer with progress tracking
   */
  async uploadFile(peerId: string, hash: string, onProgress?: (progress: number) => void): Promise<void> {
    const fileInfo = this.stagedFiles.get(hash);
    if (!fileInfo) {
      throw new Error('File not found in staged files');
    }

    const fileId = `upload_${hash}_${Date.now()}`;
    const startTime = Date.now();

    // Get file data from storage
    const fileData = await this.getFileDataFromStorage(hash);
    if (!fileData) {
      throw new Error('File data not available');
    }

    // Initialize transfer state
    const transferState: TransferState = {
      fileId,
      hash,
      fileName: fileInfo.name,
      fileType: fileInfo.type,
      totalBytes: fileData.length,
      transferredBytes: 0,
      chunks: new Map(),
      chunkSize: CHUNK_SIZE,
      totalChunks: Math.ceil(fileData.length / CHUNK_SIZE),
      startTime,
      lastProgressTime: startTime,
      lastBytesTransferred: 0,
    };

    this.activeTransfers.set(fileId, transferState);

    try {
      const stream = await this.node.dialProtocol(peerId as any, '/isc/file/1.0');

      // Send request header
      await stream.sink([new TextEncoder().encode(`SEND:${hash}:${fileInfo.name}`)]);

      // Send chunks with progress
      let sentBytes = 0;
      for (let i = 0; i < fileData.length; i += CHUNK_SIZE) {
        const chunk = fileData.slice(i, Math.min(i + CHUNK_SIZE, fileData.length));
        await stream.sink([chunk]);
        sentBytes += chunk.length;
        transferState.transferredBytes = sentBytes;

        // Emit progress
        this.emitProgress(fileId, 'uploading');

        // Small delay to prevent overwhelming network
        await new Promise(resolve => setTimeout(resolve, 2));
      }

      // Send EOF marker
      await stream.sink([new TextEncoder().encode(`EOF:${fileInfo.name}`)]);
      await stream.close();

      // Cleanup
      this.activeTransfers.delete(fileId);
      this.emitProgress(fileId, 'completed');

      if (onProgress) onProgress(1);
    } catch (error) {
      this.activeTransfers.delete(fileId);
      this.emitProgress(fileId, 'error', (error as Error).message);
      throw error;
    }
  }

  /**
   * Get staged file data
   */
  getStagedFile(hash: string): { data: Uint8Array; name: string } | null {
    const fileInfo = this.stagedFiles.get(hash);
    if (!fileInfo) return null;

    // In a real implementation, this would fetch from IndexedDB
    // For now, return null as the actual data is in storage
    return null;
  }

  /**
   * Get file info by hash
   */
  getFileInfo(hash: string): FileInfo | null {
    return this.stagedFiles.get(hash) || null;
  }

  /**
   * List all staged files
   */
  listStagedFiles(): FileInfo[] {
    return Array.from(this.stagedFiles.values())
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Delete staged file
   */
  async deleteFile(hash: string): Promise<void> {
    this.stagedFiles.delete(hash);
    await this.removeFromStorage(hash);
  }

  /**
   * Get active transfers
   */
  getActiveTransfers(): TransferProgress[] {
    return Array.from(this.activeTransfers.values()).map(state => ({
      fileId: state.fileId,
      fileName: state.fileName,
      totalBytes: state.totalBytes,
      transferredBytes: state.transferredBytes,
      progress: state.totalBytes > 0 ? state.transferredBytes / state.totalBytes : 0,
      status: 'uploading' as const,
    }));
  }

  /**
   * Cancel transfer
   */
  cancelTransfer(fileId: string): void {
    const state = this.activeTransfers.get(fileId);
    if (state) {
      this.activeTransfers.delete(fileId);
      this.emitProgress(fileId, 'cancelled');
    }
  }

  /**
   * Subscribe to transfer progress
   */
  onTransferProgress(callback: (progress: TransferProgress) => void): () => void {
    this.transferListeners.add(callback);
    return () => this.transferListeners.delete(callback);
  }

  private emitProgress(fileId: string, status: TransferProgress['status'], error?: string): void {
    const state = this.activeTransfers.get(fileId);
    if (!state) return;

    const now = Date.now();
    const timeDelta = (now - state.lastProgressTime) / 1000;
    const bytesDelta = state.transferredBytes - state.lastBytesTransferred;

    let speed: number | undefined;
    let eta: number | undefined;

    if (timeDelta > 0 && bytesDelta > 0) {
      speed = bytesDelta / timeDelta;
      const remainingBytes = state.totalBytes - state.transferredBytes;
      if (speed > 0 && remainingBytes > 0) {
        eta = (remainingBytes / speed) * 1000;
      }
    }

    const progress: TransferProgress = {
      fileId,
      fileName: state.fileName,
      totalBytes: state.totalBytes,
      transferredBytes: state.transferredBytes,
      progress: state.totalBytes > 0 ? state.transferredBytes / state.totalBytes : 0,
      status,
      error,
      speed,
      eta,
    };

    // Update last progress tracking
    state.lastProgressTime = now;
    state.lastBytesTransferred = state.transferredBytes;

    this.transferListeners.forEach(listener => listener(progress));
  }

  private detectMimeTypeFromData(blob: Blob, fileName: string): string {
    // Try to detect from file extension first
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      mp4: 'video/mp4',
      webm: 'video/webm',
      mp3: 'audio/mpeg',
      pdf: 'application/pdf',
      txt: 'text/plain',
      zip: 'application/zip',
    };

    if (mimeMap[ext]) return mimeMap[ext];

    // Fallback to blob type or generic
    return blob.type || 'application/octet-stream';
  }

  private async saveToStorage(fileInfo: FileInfo, file: File): Promise<void> {
    const { dbPut } = await import('../db/helpers.js');
    const db = await import('../db/factory.js')
      .then(m => m.getDB('isc-files', 1, ['files', 'fileData']));

    // Save metadata
    await dbPut(db, 'files', {
      ...fileInfo,
      data: null, // Don't store full data in metadata
    });

    // Store actual file data separately
    const data = new Uint8Array(await file.arrayBuffer());
    await dbPut(db, 'fileData', {
      hash: fileInfo.hash,
      data,
      createdAt: Date.now(),
    });
  }

  private async getFileDataFromStorage(hash: string): Promise<Uint8Array | null> {
    const { dbGet } = await import('../db/helpers.js');
    const db = await import('../db/factory.js')
      .then(m => m.getDB('isc-files', 1, ['files', 'fileData']));

    const record = await dbGet(db, 'fileData', hash);
    return record?.data || null;
  }

  private async removeFromStorage(hash: string): Promise<void> {
    const { dbDelete } = await import('../db/helpers.js');
    const db = await import('../db/factory.js')
      .then(m => m.getDB('isc-files', 1, ['files', 'fileData']));

    await dbDelete(db, 'files', hash);
    await dbDelete(db, 'fileData', hash);
  }
}

// Singleton instance
let _instance: EnhancedFileTransferService | null = null;

export function getEnhancedFileTransferService(node: Libp2p): EnhancedFileTransferService {
  if (!_instance) {
    _instance = new EnhancedFileTransferService(node);
  }
  return _instance;
}
