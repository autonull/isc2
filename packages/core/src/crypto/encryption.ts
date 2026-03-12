export interface EncryptedKeypair {
  publicKey: Uint8Array;
  encryptedPrivateKey: Uint8Array;
  salt: Uint8Array;
  iterations: number;
}

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;

export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passphraseKey = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase).buffer as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    passphraseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPrivateKey(
  privateKey: Uint8Array,
  passphrase: string
): Promise<EncryptedKeypair> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await deriveKeyFromPassphrase(passphrase, salt);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer, tagLength: 128 },
    key,
    privateKey.buffer as ArrayBuffer
  );

  const encryptedPrivateKey = new Uint8Array(iv.length + encrypted.byteLength);
  encryptedPrivateKey.set(iv);
  encryptedPrivateKey.set(new Uint8Array(encrypted), iv.length);

  return {
    publicKey: new Uint8Array(0),
    encryptedPrivateKey,
    salt,
    iterations: PBKDF2_ITERATIONS,
  };
}

export async function decryptPrivateKey(
  encrypted: EncryptedKeypair,
  passphrase: string
): Promise<Uint8Array> {
  const key = await deriveKeyFromPassphrase(passphrase, encrypted.salt, encrypted.iterations);

  const iv = encrypted.encryptedPrivateKey.slice(0, 12);
  const ciphertext = encrypted.encryptedPrivateKey.slice(12);

  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer, tagLength: 128 },
    key,
    ciphertext.buffer as ArrayBuffer
  );

  return new Uint8Array(decrypted);
}

export function validatePassphraseStrength(passphrase: string): {
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (passphrase.length >= 8) score++;
  else feedback.push('Use at least 8 characters');

  if (passphrase.length >= 12) score++;
  if (/[a-z]/.test(passphrase)) score++;
  else feedback.push('Add lowercase letters');

  if (/[A-Z]/.test(passphrase)) score++;
  else feedback.push('Add uppercase letters');

  if (/[0-9]/.test(passphrase)) score++;
  else feedback.push('Add numbers');

  if (/[^a-zA-Z0-9]/.test(passphrase)) score++;
  else feedback.push('Add special characters');

  return { score, feedback };
}

export async function encrypt(content: string, publicKeyBytes: Uint8Array): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);

  const publicKey = await crypto.subtle.importKey(
    'raw',
    publicKeyBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer, tagLength: 128 },
    publicKey,
    data.buffer as ArrayBuffer
  );

  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv);
  result.set(new Uint8Array(encrypted), iv.length);
  return result;
}

export async function decrypt(encryptedData: Uint8Array, privateKeyBytes: Uint8Array): Promise<string> {
  const decoder = new TextDecoder();

  const privateKey = await crypto.subtle.importKey(
    'raw',
    privateKeyBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const iv = encryptedData.slice(0, 12);
  const ciphertext = encryptedData.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer, tagLength: 128 },
    privateKey,
    ciphertext.buffer as ArrayBuffer
  );

  return decoder.decode(decrypted);
}
