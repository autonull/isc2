/* eslint-disable */
/**
 * Enhanced File Transfer Service
 *
 * Features:
 * - Chunked file transfer with progress tracking
 * - MIME type detection
 * - File preview generation
 * - Transfer state management
 */

import { FileProtocol } from '../protocol/file.ts';

export interface TransferProgress {
  fileId: string;
  fileName: string;
  totalBytes: number;
  transferredBytes: number;
  progress: number;
  status: 'pending' | 'uploading' | 'downloading' | 'paused' | 'completed' | 'error' | 'cancelled';
  error?: string;
  speed?: number;
  eta?: number;
}

export interface FileInfo {
  hash: string;
  name: string;
  type: string;
  size: number;
  preview?: string;
  createdAt: number;
  isImage: boolean;
  isVideo: boolean;
  isAudio: boolean;
  isDocument: boolean;
  isArchive: boolean;
}

const CHUNK_SIZE = 64 * 1024;
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_STAGED_FILES = 100;

const MIME_CATEGORIES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  video: ['video/mp4', 'video/webm', 'video/ogg'],
  audio: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'],
  document: ['application/pdf', 'text/plain', 'text/html'],
  archive: ['application/zip', 'application/gzip'],
};

export class EnhancedFileTransferService {
  private node: any;
  private protocol: FileProtocol;
  private stagedFiles = new Map<string, FileInfo>();
  private stagedData = new Map<string, Uint8Array>();
  private transferListeners = new Set<(progress: TransferProgress) => void>();

  constructor(node: any) {
    this.node = node;
    this.protocol = new FileProtocol(node);
    this.setupProtocolHandler();
  }

  private setupProtocolHandler(): void {
    this.node.handle('/isc/file/1.0.0', (event: any) => {
      this.protocol
        .handleStream(event.stream, (hash: string) => this.getStagedFile(hash))
        .catch(console.error);
    });
  }

  private detectMimeType(file: File): string {
    if (file.type) return file.type;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
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
    return mimeMap[ext] || 'application/octet-stream';
  }

  private categorizeFile(mimeType: string) {
    return {
      isImage: MIME_CATEGORIES.image.includes(mimeType),
      isVideo: MIME_CATEGORIES.video.includes(mimeType),
      isAudio: MIME_CATEGORIES.audio.includes(mimeType),
      isDocument: MIME_CATEGORIES.document.includes(mimeType),
      isArchive: MIME_CATEGORIES.archive.includes(mimeType),
    };
  }

  private async generatePreview(file: File, mimeType: string): Promise<string | undefined> {
    if (file.size > 5 * 1024 * 1024) return undefined;

    if (MIME_CATEGORIES.image.includes(mimeType)) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(undefined);
        reader.readAsDataURL(file);
      });
    }
    return undefined;
  }

  async stageFile(file: File): Promise<FileInfo> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(
        `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB (max: ${MAX_FILE_SIZE / 1024 / 1024}MB)`
      );
    }

    const mimeType = this.detectMimeType(file);
    const hash = await FileProtocol.computeHash(file);
    const preview = await this.generatePreview(file, mimeType);
    const categories = this.categorizeFile(mimeType);

    if (this.stagedFiles.size >= MAX_STAGED_FILES) {
      const oldest = Array.from(this.stagedFiles.entries()).sort(
        (a, b) => a[1].createdAt - b[1].createdAt
      )[0];
      if (oldest) {
        this.stagedFiles.delete(oldest[0]);
        this.stagedData.delete(oldest[0]);
      }
    }

    const fileData = new Uint8Array(await file.arrayBuffer());

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
    this.stagedData.set(hash, fileData);
    await this.saveToStorage(fileInfo, fileData);
    return fileInfo;
  }

  async downloadFile(
    peerId: string,
    hash: string,
    fileName?: string
  ): Promise<{ blob: Blob; info: FileInfo }> {
    const blob = await this.protocol.requestFile(peerId, hash);
    const mimeType = this.detectMimeTypeFromBlob(blob, fileName || hash);

    const fileInfo: FileInfo = {
      hash,
      name: fileName || hash,
      type: mimeType,
      size: blob.size,
      createdAt: Date.now(),
      ...this.categorizeFile(mimeType),
    };

    return { blob, info: fileInfo };
  }

  async uploadFile(peerId: string, hash: string): Promise<void> {
    const fileInfo = this.stagedFiles.get(hash);
    if (!fileInfo) throw new Error('File not found in staged files');

    const fileData = this.stagedData.get(hash) ?? (await this.getFileDataFromStorage(hash));
    if (!fileData) throw new Error('File data not available');

    const stream = await this.node.dialProtocol(peerId, '/isc/file/1.0.0');
    await stream.sink([new TextEncoder().encode(`SEND:${hash}:${fileInfo.name}`)]);

    for (let i = 0; i < fileData.length; i += CHUNK_SIZE) {
      const chunk = fileData.slice(i, Math.min(i + CHUNK_SIZE, fileData.length));
      await stream.sink([chunk]);
      await new Promise((r) => setTimeout(r, 2));
    }

    await stream.sink([new TextEncoder().encode(`EOF:${fileInfo.name}`)]);
    await stream.close();
  }

  getStagedFile(hash: string): { data: Uint8Array; name: string } | null {
    const fileInfo = this.stagedFiles.get(hash);
    const fileData = this.stagedData.get(hash);
    if (!fileInfo || !fileData) return null;
    return { data: fileData, name: fileInfo.name };
  }

  getFileInfo(hash: string): FileInfo | null {
    return this.stagedFiles.get(hash) || null;
  }

  listStagedFiles(): FileInfo[] {
    return Array.from(this.stagedFiles.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  async deleteFile(hash: string): Promise<void> {
    this.stagedFiles.delete(hash);
    this.stagedData.delete(hash);
    await this.removeFromStorage(hash);
  }

  onTransferProgress(callback: (progress: TransferProgress) => void): () => void {
    this.transferListeners.add(callback);
    return () => this.transferListeners.delete(callback);
  }

  private detectMimeTypeFromBlob(blob: Blob, fileName: string): string {
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
    return blob.type || 'application/octet-stream';
  }

  private async saveToStorage(fileInfo: FileInfo, fileData: Uint8Array): Promise<void> {
    const { getDB, dbPut } = await import('../db/factory.ts');
    const db = await getDB('isc-files', 1, ['files', 'fileData']);
    await dbPut(db, 'files', { ...fileInfo, data: null });
    await dbPut(db, 'fileData', { hash: fileInfo.hash, data: fileData, createdAt: Date.now() });
  }

  private async getFileDataFromStorage(hash: string): Promise<Uint8Array | null> {
    const { getDB, dbGet } = await import('../db/factory.ts');
    const db = await getDB('isc-files', 1, ['files', 'fileData']);
    const record = await dbGet<{ hash: string; data: Uint8Array; createdAt: number }>(
      db,
      'fileData',
      hash
    );
    return record?.data ?? null;
  }

  private async removeFromStorage(hash: string): Promise<void> {
    const { getDB, dbDelete } = await import('../db/factory.ts');
    const db = await getDB('isc-files', 1, ['files', 'fileData']);
    await dbDelete(db, 'files', hash);
    await dbDelete(db, 'fileData', hash);
  }
}

let _instance: EnhancedFileTransferService | null = null;

export function getEnhancedFileTransferService(node: any): EnhancedFileTransferService {
  if (!_instance) _instance = new EnhancedFileTransferService(node);
  return _instance;
}
