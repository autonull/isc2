import type { Signature } from './keypair.js';

export async function sign(payload: Uint8Array, privateKey: CryptoKey): Promise<Signature> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API is not available');
  }

  const signature = await globalThis.crypto.subtle.sign(
    'Ed25519',
    privateKey,
    payload
  );

  return { data: new Uint8Array(signature), algorithm: 'Ed25519' };
}

export async function verify(
  payload: Uint8Array,
  signature: Signature,
  publicKey: CryptoKey
): Promise<boolean> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API is not available');
  }

  if (signature.algorithm !== 'Ed25519') {
    throw new Error(`Unsupported signature algorithm: ${signature.algorithm}`);
  }

  try {
    return await globalThis.crypto.subtle.verify(
      'Ed25519',
      publicKey,
      signature.data,
      payload
    );
  } catch {
    return false;
  }
}

export async function signObject<T extends Record<string, unknown>>(
  obj: T,
  privateKey: CryptoKey
): Promise<T & { signature: string; timestamp: number }> {
  const payload = new TextEncoder().encode(JSON.stringify(obj));
  const sig = await sign(payload, privateKey);

  return { ...obj, signature: bytesToHex(sig.data), timestamp: Date.now() };
}

export async function verifyObject<T extends Record<string, unknown>>(
  signedObj: T & { signature: string; timestamp: number },
  publicKey: CryptoKey
): Promise<T | null> {
  try {
    const { signature, timestamp: _ts, ...obj } = signedObj;
    const payload = new TextEncoder().encode(JSON.stringify(obj));
    const sigData = hexToBytes(signature);

    return (await verify(payload, { data: sigData, algorithm: 'Ed25519' }, publicKey))
      ? (obj as unknown as T)
      : null;
  } catch {
    return null;
  }
}

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const hexToBytes = (hex: string): Uint8Array =>
  Uint8Array.from({ length: hex.length / 2 }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16));
