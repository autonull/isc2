/**
 * File Transfer Protocol - /isc/file/1.0
 * Matches Java's FileProtocol with length-prefixed frames
 *
 * @see java/src/main/java/network/isc/protocol/FileProtocol.java
 */

import type { Libp2p } from 'libp2p';
import { toString, fromString } from 'uint8arrays';

const PROTOCOL_FILE = '/isc/file/1.0.0';
const CHUNK_SIZE = 8192;
const MAX_FILE_SIZE = 100 * 1024 * 1024;

interface ISCStream {
  sink(source: AsyncIterable<Uint8Array>): Promise<void>;
  source: AsyncIterable<Uint8Array>;
  close(): Promise<void>;
}

export class FileProtocol {
  private node: Libp2p;

  constructor(node: Libp2p) {
    this.node = node;
  }

  async requestFile(peerId: string, hash: string): Promise<Blob> {
    const stream = (await this.node.dialProtocol(
      peerId as any,
      PROTOCOL_FILE
    )) as unknown as ISCStream;
    await stream.sink(
      (async function* () {
        yield fromString(`REQ:${hash}`, 'utf-8');
      })()
    );

    const chunks: Uint8Array[] = [];
    for await (const chunk of stream.source) {
      const text = toString(chunk, 'utf-8');
      if (text.startsWith('EOF:')) break;
      chunks.push(chunk);
    }

    await stream.close();
    return new Blob(chunks as BlobPart[]);
  }

  async sendFile(peerId: string, file: File): Promise<void> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${file.size} bytes (max: ${MAX_FILE_SIZE})`);
    }

    const stream = (await this.node.dialProtocol(
      peerId as any,
      PROTOCOL_FILE
    )) as unknown as ISCStream;
    const chunks = await this.readFileChunks(file);

    await stream.sink(
      (async function* () {
        for (const chunk of chunks) {
          yield chunk;
          await new Promise((r) => setTimeout(r, 1));
        }
        yield fromString(`EOF:${file.name}`, 'utf-8');
      })()
    );
    await stream.close();
  }

  async handleStream(
    stream: ISCStream,
    getStagedFile: (hash: string) => { data: Uint8Array; name: string } | null
  ): Promise<void> {
    try {
      let requestedHash = '';
      for await (const chunk of stream.source) {
        const text = toString(chunk, 'utf-8');
        if (text.startsWith('REQ:')) {
          requestedHash = text.substring(4);
          break;
        }
      }

      if (requestedHash) {
        const fileData = getStagedFile(requestedHash);
        if (fileData) {
          await stream.sink(
            (async function* () {
              for (let i = 0; i < fileData.data.length; i += CHUNK_SIZE) {
                yield fileData.data.slice(i, Math.min(i + CHUNK_SIZE, fileData.data.length));
                await new Promise((r) => setTimeout(r, 1));
              }
              yield fromString(`EOF:${fileData.name}`, 'utf-8');
            })()
          );
        } else {
          await stream.sink(
            (async function* () {
              yield fromString(`EOF:NOT_FOUND`, 'utf-8');
            })()
          );
        }
      }
    } catch (e) {
      console.error('Error handling file stream', e);
    } finally {
      await stream.close();
    }
  }

  private async readFileChunks(file: File): Promise<Uint8Array[]> {
    const chunks: Uint8Array[] = [];
    const data = new Uint8Array(await file.arrayBuffer());
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      chunks.push(data.slice(i, Math.min(i + CHUNK_SIZE, data.length)));
    }
    return chunks;
  }

  static async computeHash(file: File): Promise<string> {
    let cryptoSubtle: any;
    if (
      typeof crypto !== 'undefined' &&
      crypto.subtle &&
      typeof crypto.subtle.digest === 'function'
    ) {
      cryptoSubtle = crypto.subtle;
    } else {
      const cryptoMod = await import('crypto').catch(() => null);
      cryptoSubtle = cryptoMod?.webcrypto?.subtle;
    }

    if (!cryptoSubtle || typeof cryptoSubtle.digest !== 'function') {
      throw new Error('crypto.subtle.digest is not available');
    }

    const hashBuffer = await cryptoSubtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
