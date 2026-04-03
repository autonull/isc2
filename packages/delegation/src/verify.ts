import type { DelegateResponse } from '@isc/protocol/messages';

export interface EmbedResult {
  embedding: number[];
  model: string;
  norm: number;
}

export interface ANNResult {
  matches: string[];
  scores: number[];
}

export interface SigVerifyResult {
  valid: boolean;
}

export type ServiceResult = EmbedResult | ANNResult | SigVerifyResult;

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

async function verifySignature(response: DelegateResponse, publicKey: Uint8Array): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey('raw', toArrayBuffer(publicKey), { name: 'Ed25519' }, true, ['verify']);
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify({
      type: response.type,
      requestID: response.requestID,
      service: response.service,
      payload: Array.from(response.payload),
      responderPubKey: Array.from(response.responderPubKey),
      timestamp: response.timestamp,
    }));
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, toArrayBuffer(response.signature), toArrayBuffer(data));
  } catch {
    console.error('Signature verification error');
    return false;
  }
}

function decodeJsonResponse<T>(payload: Uint8Array): T | null {
  try {
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(payload)) as T;
  } catch {
    return null;
  }
}

export async function verifyDelegationResponse(
  response: DelegateResponse,
  expectedRequestID: string,
  expectedModel: string,
  supernodePubKey: Uint8Array
): Promise<boolean> {
  if (response.requestID !== expectedRequestID) {
    console.warn('Request ID mismatch');
    return false;
  }

  const validSignature = await verifySignature(response, supernodePubKey);
  if (!validSignature) {
    console.warn('Invalid signature');
    return false;
  }

  if (response.service === 'embed') {
    const result = decodeJsonResponse<EmbedResult>(response.payload);
    if (!result) {return false;}
    if (result.model !== expectedModel) {
      console.warn('Model mismatch:', result.model, '!=', expectedModel);
      return false;
    }
    const norm = Math.sqrt(result.embedding.reduce((sum: number, v: number) => sum + v * v, 0));
    if (Math.abs(norm - 1.0) > 0.01) {
      console.warn('Invalid norm:', norm);
      return false;
    }
  }

  return true;
}

export const decodeEmbedResponse = (payload: Uint8Array): EmbedResult | null => decodeJsonResponse<EmbedResult>(payload);
export const decodeANNResponse = (payload: Uint8Array): ANNResult | null => decodeJsonResponse<ANNResult>(payload);
export const decodeSigVerifyResponse = (payload: Uint8Array): SigVerifyResult | null => decodeJsonResponse<SigVerifyResult>(payload);
