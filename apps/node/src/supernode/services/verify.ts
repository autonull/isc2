/* eslint-disable */
import type { SigVerifyRequest, SigVerifyResponse } from './types.js';
import { validateSigVerifyRequest, serializeServiceResponse } from './types.js';

export class SigVerifyService {
  async handleRequest(payload: Uint8Array): Promise<Uint8Array> {
    const decoder = new TextDecoder();
    const req: SigVerifyRequest = JSON.parse(decoder.decode(payload));

    if (!validateSigVerifyRequest(req)) {
      throw new Error('Invalid signature verification request');
    }

    let valid = false;
    try {
      valid = await this.verify(req.payload, req.signature, req.publicKey);
    } catch {
      valid = false;
    }

    const response: SigVerifyResponse = { valid };
    return serializeServiceResponse('sig_verify', response);
  }

  private async verify(
    payload: Uint8Array,
    signature: Uint8Array,
    publicKey: Uint8Array
  ): Promise<boolean> {
    try {
      const key = await crypto.subtle.importKey(
        'raw',
        publicKey.buffer as ArrayBuffer,
        { name: 'Ed25519' },
        true,
        ['verify']
      );

      return await crypto.subtle.verify(
        { name: 'Ed25519' },
        key,
        signature.buffer as ArrayBuffer,
        payload.buffer as ArrayBuffer
      );
    } catch {
      return false;
    }
  }
}
