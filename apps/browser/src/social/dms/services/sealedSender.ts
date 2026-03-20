/**
 * ISC Phase E3: Sealed Sender
 *
 * Encrypts sender identity inside message payload so relay nodes cannot
 * observe the social graph. Uses Signal-style sealed sender approach.
 *
 * The recipient's public key is used to derive a shared secret via ECDH,
 * which encrypts the sender's identity. Only the recipient can decrypt
 * the sender identity from the message.
 */

export interface SealedEnvelope {
  encryptedSender: Uint8Array;
  iv: Uint8Array;
  ephemeralPublicKey: Uint8Array;
}

export interface UnsealedEnvelope {
  senderId: string;
  ephemeralPublicKey: Uint8Array;
}

const SEALED_SENDER_KEY_INFO = 'ISC-SEALED-SENDER-v1';

async function deriveSharedSecret(
  privateKey: CryptoKey,
  publicKey: Uint8Array
): Promise<CryptoKey> {
  const importedPublicKey = await crypto.subtle.importKey(
    'raw',
    publicKey.buffer as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: importedPublicKey },
    privateKey,
    256
  );

  const info = new TextEncoder().encode(SEALED_SENDER_KEY_INFO);
  const keyMaterial = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, [
    'deriveBits',
  ]);

  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info },
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function sealSenderIdentity(
  senderId: string,
  recipientPublicKey: Uint8Array
): Promise<SealedEnvelope> {
  const ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  const ephemeralPublicRaw = await crypto.subtle.exportKey('raw', ephemeralKeyPair.publicKey);
  const ephemeralPublicKey = new Uint8Array(ephemeralPublicRaw);

  const sharedKey = await deriveSharedSecret(ephemeralKeyPair.privateKey, recipientPublicKey);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const senderBytes = new TextEncoder().encode(senderId);

  const encryptedSender = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    senderBytes
  );

  return {
    encryptedSender: new Uint8Array(encryptedSender),
    iv,
    ephemeralPublicKey,
  };
}

export async function unsealSenderIdentity(
  sealed: SealedEnvelope,
  recipientPrivateKey: CryptoKey
): Promise<UnsealedEnvelope> {
  const sharedKey = await deriveSharedSecret(recipientPrivateKey, sealed.ephemeralPublicKey);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: sealed.iv.buffer as ArrayBuffer },
    sharedKey,
    sealed.encryptedSender.buffer as ArrayBuffer
  );

  const senderId = new TextDecoder().decode(decrypted);

  return {
    senderId,
    ephemeralPublicKey: sealed.ephemeralPublicKey,
  };
}

export function extractSealedEnvelope(data: any): SealedEnvelope | null {
  if (!data?.encryptedSender || !data?.iv || !data?.ephemeralPublicKey) {
    return null;
  }
  return {
    encryptedSender:
      data.encryptedSender instanceof Uint8Array
        ? data.encryptedSender
        : new Uint8Array(data.encryptedSender),
    iv: data.iv instanceof Uint8Array ? data.iv : new Uint8Array(data.iv),
    ephemeralPublicKey:
      data.ephemeralPublicKey instanceof Uint8Array
        ? data.ephemeralPublicKey
        : new Uint8Array(data.ephemeralPublicKey),
  };
}
