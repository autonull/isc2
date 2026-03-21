import { FileProtocol } from '../protocol/file.js';
import type { Libp2p } from 'libp2p';

interface StagedFile {
  hash: string;
  name: string;
  type: string;
  size: number;
  data: Uint8Array;
  timestamp: number;
}

export class FileTransferService {
  private protocol: FileProtocol;
  private stagedFiles = new Map<string, StagedFile>();
  private readonly MAX_STAGED_FILES = 50;

  constructor(node: Libp2p) {
    this.protocol = new FileProtocol(node);
    node.handle('/isc/file/1.0.0', (event: any) => {
      this.protocol
        .handleStream(event.stream, (hash: string) => this.getStagedFile(hash))
        .catch(console.error);
    });
  }

  /**
   * Stage file for sharing
   */
  async stageFile(file: File): Promise<string> {
    const hash = await FileProtocol.computeHash(file);
    const data = new Uint8Array(await file.arrayBuffer());

    // Cleanup if too many staged files
    if (this.stagedFiles.size >= this.MAX_STAGED_FILES) {
      const oldest = Array.from(this.stagedFiles.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      )[0];
      if (oldest) this.stagedFiles.delete(oldest[0]);
    }

    this.stagedFiles.set(hash, {
      hash,
      name: file.name,
      type: file.type,
      size: file.size,
      data,
      timestamp: Date.now(),
    });

    await this.saveToStorage(hash);
    return hash;
  }

  /**
   * Download file from network
   */
  async downloadFile(peerId: string, hash: string): Promise<Blob> {
    return this.protocol.requestFile(peerId, hash);
  }

  /**
   * Get staged file
   */
  getStagedFile(hash: string): StagedFile | null {
    return this.stagedFiles.get(hash) || null;
  }

  private async saveToStorage(hash: string): Promise<void> {
    const { getDB, dbPut } = await import('../db/factory.js');
    const db = await getDB('isc-files', 1, ['files']);
    await dbPut(db, 'files', this.stagedFiles.get(hash)!);
  }
}

let _instance: FileTransferService | null = null;
export function getFileTransferService(node: Libp2p): FileTransferService {
  if (!_instance) _instance = new FileTransferService(node);
  return _instance;
}
