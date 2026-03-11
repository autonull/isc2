import type { DelegateRequest } from '@isc/protocol/src/messages.js';

export interface DelegationRequestOptions {
  requestID: string;
  service: 'embed' | 'ann_query' | 'sig_verify';
  payload: Uint8Array;
  requesterPubKey: Uint8Array;
  privateKey: CryptoKey;
  supernodePubKey: Uint8Array;
}

export async function createDelegationRequest(
  options: DelegationRequestOptions
): Promise<DelegateRequest> {
  const { requestID, service, payload, requesterPubKey, privateKey, supernodePubKey } = options;

  const encryptedPayload = await encryptPayload(payload, supernodePubKey);

  const request: DelegateRequest = {
    type: 'delegate_request',
    requestID,
    service,
    payload: encryptedPayload,
    requesterPubKey,
    timestamp: Date.now(),
    signature: new Uint8Array(),
  };

  request.signature = await signRequest(request, privateKey);

  return request;
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

async function encryptPayload(
  plaintext: Uint8Array,
  _supernodePubKey: Uint8Array
): Promise<Uint8Array> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    toArrayBuffer(plaintext)
  );

  const exportedKey = await crypto.subtle.exportKey('raw', key);

  const combined = new Uint8Array(iv.byteLength + exportedKey.byteLength + encrypted.byteLength);
  combined.set(new Uint8Array(iv), 0);
  combined.set(new Uint8Array(exportedKey), iv.byteLength);
  combined.set(new Uint8Array(encrypted), iv.byteLength + exportedKey.byteLength);

  return combined;
}

async function signRequest(request: DelegateRequest, privateKey: CryptoKey): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(
    JSON.stringify({
      type: request.type,
      requestID: request.requestID,
      service: request.service,
      payload: Array.from(request.payload),
      requesterPubKey: Array.from(request.requesterPubKey),
      timestamp: request.timestamp,
    })
  );

  const signature = await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, toArrayBuffer(data));
  return new Uint8Array(signature);
}

export async function decryptResponsePayload(
  encrypted: Uint8Array,
  _privateKey: CryptoKey
): Promise<Uint8Array> {
  const iv = encrypted.slice(0, 12);
  const keyBytes = encrypted.slice(12, 12 + 32);
  const ciphertext = encrypted.slice(12 + 32);

  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(keyBytes),
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    toArrayBuffer(ciphertext)
  );
  return new Uint8Array(decrypted);
}
