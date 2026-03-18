import { describe, it, expect } from 'vitest';
import { FileProtocol } from '../../src/protocol/file.js';

describe('FileProtocol', () => {
  it('should compute file hash', async () => {
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const hash = await FileProtocol.computeHash(file);
    expect(hash).toHaveLength(64); // SHA-256 hex length
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it('should reject files over size limit', async () => {
    // Create 101MB file
    const largeFile = new File([new ArrayBuffer(101 * 1024 * 1024)], 'large.bin');
    const protocol = new FileProtocol({} as any);
    await expect(protocol.sendFile('peer1', largeFile))
      .rejects.toThrow('File too large');
  });
});
