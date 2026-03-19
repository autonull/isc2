/**
 * File Transfer Protocol - /isc/file/1.0
 * Matches Java's FileProtocol with length-prefixed frames
 *
 * @see java/src/main/java/network/isc/protocol/FileProtocol.java
 */

import type { Libp2p } from 'libp2p';
import type { Stream } from '@libp2p/interface';
import { toString, fromString } from 'uint8arrays';
import { pipe } from 'it-pipe';

const PROTOCOL_FILE = '/isc/file/1.0';
const CHUNK_SIZE = 8192; // 8KB chunks - balance between overhead and throughput
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit for browser memory

export class FileProtocol {
  private node: Libp2p;

  constructor(node: Libp2p) {
    this.node = node;
  }

  /**
   * Request file from peer
   * @param peerId - Peer to request from
   * @param hash - SHA-256 hash of file
   * @returns Blob containing file data
   */
  async requestFile(peerId: string, hash: string): Promise<Blob> {
    const stream = await this.node.dialProtocol(peerId as any, PROTOCOL_FILE);

    // Write request to the stream's sink
    const requestGen = async function* () {
      yield fromString(`REQ:${hash}`, 'utf-8');
    };
    await pipe(requestGen(), stream.sink);

    const chunks: Uint8Array[] = [];

    // Read response from the stream's source
    await pipe(
      stream.source,
      async function (source: any) {
        for await (const chunk of source) {
          const chunkData = 'subarray' in chunk ? chunk.subarray() : chunk;
          const text = toString(chunkData, 'utf-8');
          if (text.startsWith('EOF:')) break; // End of transfer marker
          chunks.push(new Uint8Array(chunkData.buffer, chunkData.byteOffset, chunkData.byteLength));
        }
      }
    );

    await stream.close();

    return new Blob(chunks);
  }

  /**
   * Send file to peer
   * @param peerId - Peer to send to
   * @param file - File to send
   */
  async sendFile(peerId: string, file: File): Promise<void> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${file.size} bytes (max: ${MAX_FILE_SIZE})`);
    }

    const stream = await this.node.dialProtocol(peerId as any, PROTOCOL_FILE);
    const chunks = await this.readFileChunks(file);

    async function* yieldChunks() {
      for (const chunk of chunks) {
        yield chunk;
        await new Promise(r => setTimeout(r, 1)); // Prevent overwhelming network
      }
      yield fromString(`EOF:${file.name}`, 'utf-8');
    }

    await pipe(yieldChunks(), stream.sink);
    await stream.close();
  }

  async handleStream(stream: Stream, getStagedFile: (hash: string) => { data: Uint8Array, name: string } | null): Promise<void> {
    try {
      let requestedHash = '';

      await pipe(
        stream.source,
        async function (source: any) {
          for await (const chunk of source) {
            const chunkData = 'subarray' in chunk ? chunk.subarray() : chunk;
            const text = toString(chunkData, 'utf-8');
            if (text.startsWith('REQ:')) {
              requestedHash = text.substring(4);
              break; // Stop reading after we get the request
            }
          }
        }
      );

      if (requestedHash) {
        const fileData = getStagedFile(requestedHash);
        if (fileData) {
          async function* yieldChunks() {
            // chunk data
            for (let i = 0; i < fileData.data.length; i += CHUNK_SIZE) {
              yield fileData.data.slice(i, Math.min(i + CHUNK_SIZE, fileData.data.length));
              await new Promise(r => setTimeout(r, 1)); // Prevent overwhelming network
            }
            yield fromString(`EOF:${fileData.name}`, 'utf-8');
          }
          await pipe(yieldChunks(), stream.sink);
        } else {
          await pipe([fromString(`EOF:NOT_FOUND`, 'utf-8')], stream.sink);
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

  /**
   * Compute SHA-256 hash of file
   */
  static async computeHash(file: File): Promise<string> {
    // Determine crypto.subtle context properly depending on node or browser test environments.
    let cryptoSubtle: any;
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
      cryptoSubtle = crypto.subtle;
    } else {
      const cryptoMod = await import('crypto').catch(() => null);
      cryptoSubtle = cryptoMod?.webcrypto?.subtle;
    }

    if (!cryptoSubtle || typeof cryptoSubtle.digest !== 'function') {
      throw new Error("crypto.subtle.digest is not available");
    }

    const hashBuffer = await cryptoSubtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
