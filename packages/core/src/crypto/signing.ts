import type { Signature } from './keypair.js';

/**
 * Signs a payload using Ed25519.
 *
 * @param payload - Data to sign (Uint8Array)
 * @param privateKey - Private key for signing
 * @returns Digital signature
 * @throws Error if signing fails
 *
 * @example
 * ```typescript
 * const payload = new TextEncoder().encode('Hello, World!');
 * const signature = await sign(payload, keypair.privateKey);
 * ```
 */
export async function sign(payload: Uint8Array, privateKey: CryptoKey): Promise<Signature> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API is not available');
  }

  const signature = await globalThis.crypto.subtle.sign(
    'Ed25519',
    privateKey,
    payload.buffer as ArrayBuffer
  );

  return { data: new Uint8Array(signature), algorithm: 'Ed25519' };
}

/**
 * Verifies a digital signature.
 *
 * @param payload - Original data that was signed
 * @param signature - Signature to verify
 * @param publicKey - Public key for verification
 * @returns True if signature is valid, false otherwise
 *
 * @example
 * ```typescript
 * const isValid = await verify(payload, signature, keypair.publicKey);
 * if (isValid) {
 *   console.log('Signature is valid!');
 * } else {
 *   console.log('Signature verification failed!');
 * }
 * ```
 */
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
      signature.data.buffer as ArrayBuffer,
      payload.buffer as ArrayBuffer
    );
  } catch {
    return false;
  }
}

/**
 * Signs a JSON-serializable object.
 *
 * @param obj - Object to sign (will be JSON-stringified)
 * @param privateKey - Private key for signing
 * @returns Object with original data and signature
 */
export async function signObject<T extends Record<string, unknown>>(
  obj: T,
  privateKey: CryptoKey
): Promise<T & { signature: string; timestamp: number }> {
  const payload = new TextEncoder().encode(JSON.stringify(obj));
  const sig = await sign(payload, privateKey);

  return { ...obj, signature: bytesToHex(sig.data), timestamp: Date.now() };
}

/**
 * Verifies and extracts a signed object.
 *
 * @param signedObj - Signed object with signature field
 * @param publicKey - Public key for verification
 * @returns Original object without signature, or null if verification fails
 */
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
