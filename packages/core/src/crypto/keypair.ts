export interface Keypair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export interface Signature {
  data: Uint8Array;
  algorithm: 'Ed25519';
}

export type PublicKey = CryptoKey;

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export async function generateKeypair(): Promise<Keypair> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API is not available');
  }

  const keyPair = await globalThis.crypto.subtle.generateKey(
    { name: 'Ed25519', namedCurve: 'Ed25519' },
    true,
    ['sign', 'verify']
  );

  return { publicKey: keyPair.publicKey, privateKey: keyPair.privateKey };
}

export async function exportKeypair(keypair: Keypair): Promise<{
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}> {
  const [publicKey, privateKey] = await Promise.all([
    globalThis.crypto.subtle.exportKey('raw', keypair.publicKey),
    globalThis.crypto.subtle.exportKey('pkcs8', keypair.privateKey),
  ]);

  return { publicKey: new Uint8Array(publicKey), privateKey: new Uint8Array(privateKey) };
}

export async function importKeypair(
  publicKey: Uint8Array,
  privateKey: Uint8Array
): Promise<Keypair> {
  const [pubKey, privKey] = await Promise.all([
    globalThis.crypto.subtle.importKey(
      'raw',
      publicKey.buffer as ArrayBuffer,
      { name: 'Ed25519', namedCurve: 'Ed25519' },
      true,
      ['verify']
    ),
    globalThis.crypto.subtle.importKey(
      'pkcs8',
      privateKey.buffer as ArrayBuffer,
      { name: 'Ed25519', namedCurve: 'Ed25519' },
      true,
      ['sign']
    ),
  ]);

  return { publicKey: pubKey, privateKey: privKey };
}

export async function formatKeyFingerprint(publicKey: CryptoKey): Promise<string> {
  const keyData = await globalThis.crypto.subtle.exportKey('raw', publicKey);
  return base58Encode(new Uint8Array(keyData)).slice(0, 16);
}

function base58Encode(data: Uint8Array): string {
  let num = BigInt(0);
  for (const byte of data) {
    num = num * BigInt(256) + BigInt(byte);
  }

  let encoded = '';
  while (num > BigInt(0)) {
    const remainder = Number(num % BigInt(58));
    num = num / BigInt(58);
    encoded = BASE58_ALPHABET[remainder] + encoded;
  }

  const leadingZeros = data.findIndex((b) => b !== 0);
  return (leadingZeros === -1 ? '' : '1'.repeat(leadingZeros)) + encoded || '1';
}
