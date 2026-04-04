/**
 * Double Ratchet Protocol Implementation
 *
 * Provides forward secrecy for conversations by rotating session keys.
 * Based on the Signal Protocol's Double Ratchet algorithm.
 *
 * This implementation uses ECDH for the DH ratchet and symmetric ratchet for message keys.
 */

export interface RatchetState {
  dhPrivate: CryptoKey;
  dhPublic: Uint8Array;
  rootKey: Uint8Array;
  sentChainKey: Uint8Array | null;
  receivedChainKey: Uint8Array | null;
  sentMessageNumber: number;
  receivedMessageNumber: number;
  skippedKeys: Map<string, Uint8Array>;
  lastRemotePublic: Uint8Array | null;
  createdAt: number;
  lastRatchetAt: number;
}

export interface RatchetKeys {
  encryptionKey: Uint8Array;
  macKey: Uint8Array;
}

const KEY_LENGTH = 32;
const MAC_KEY_LENGTH = 32;
const MAX_SKIP = 1000;

function generateRandomBytes(length: number): Uint8Array {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return array;
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data.buffer as ArrayBuffer);

  return new Uint8Array(signature);
}

async function hkdf(
  input: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const prk = await hmac(salt, input);

  let output: Uint8Array = new Uint8Array(0);
  let prev: Uint8Array = new Uint8Array(0);
  const iterations = Math.ceil(length / 32);

  for (let i = 0; i < iterations; i++) {
    const data = new Uint8Array(prev.length + info.length + 1);
    data.set(prev);
    data.set(info, prev.length);
    data[data.length - 1] = i + 1;

    prev = await hmac(prk, data);
    const newOutput = new Uint8Array(output.length + prev.length);
    newOutput.set(output);
    newOutput.set(prev, output.length);
    output = newOutput;
  }

  return output.slice(0, length);
}

async function kdfChainKey(
  chainKey: Uint8Array
): Promise<{ messageKey: Uint8Array; nextChainKey: Uint8Array }> {
  const derived = await hkdf(
    chainKey,
    chainKey,
    new TextEncoder().encode('ChainKey'),
    KEY_LENGTH * 2
  );
  return { messageKey: derived.slice(0, KEY_LENGTH), nextChainKey: derived.slice(KEY_LENGTH) };
}

async function advanceChainKey(chainKey: Uint8Array): Promise<{ messageKey: Uint8Array; nextChainKey: Uint8Array }> {
  return kdfChainKey(chainKey);
}

async function deriveMessageKeysFromMessageKey(messageKey: Uint8Array): Promise<RatchetKeys> {
  const keys = await hkdf(
    messageKey,
    new Uint8Array(KEY_LENGTH),
    new TextEncoder().encode('MessageKeys'),
    KEY_LENGTH + MAC_KEY_LENGTH
  );

  return {
    encryptionKey: keys.slice(0, KEY_LENGTH),
    macKey: keys.slice(KEY_LENGTH),
  };
}

async function deriveMessageKeys(
  chainKey: Uint8Array
): Promise<{ keys: RatchetKeys; nextChainKey: Uint8Array }> {
  const { messageKey, nextChainKey } = await kdfChainKey(chainKey);
  const keys = await deriveMessageKeysFromMessageKey(messageKey);
  return { keys, nextChainKey };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function performECDH(privateKey: CryptoKey, publicKey: Uint8Array): Promise<Uint8Array> {
  const x = publicKey.slice(1, 33);
  const y = publicKey.slice(33, 65);

  const publicJwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: bytesToBase64Url(x),
    y: bytesToBase64Url(y),
    ext: true,
  };

  const publicCryptoKey = await crypto.subtle.importKey('jwk', publicJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicCryptoKey },
    privateKey,
    256
  );

  return new Uint8Array(derivedBits);
}

async function deriveChainKeys(
  rootKey: Uint8Array,
  dhOutput: Uint8Array
): Promise<{ rootKey: Uint8Array; chainKey: Uint8Array }> {
  const salt = rootKey;
  const info = new TextEncoder().encode('RatchetChain');
  const derived = await hkdf(dhOutput, salt, info, KEY_LENGTH * 2);
  return { rootKey: derived.slice(0, KEY_LENGTH), chainKey: derived.slice(KEY_LENGTH) };
}

async function generateECDHKeypair(): Promise<{
  privateKey: CryptoKey;
  publicKey: Uint8Array;
}> {
  const keyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);

  const publicKeyBuffer = await crypto.subtle.exportKey('raw', keyPair.publicKey);

  return {
    privateKey: keyPair.privateKey,
    publicKey: new Uint8Array(publicKeyBuffer),
  };
}

export async function initializeRatchet(
  localIdentity: Uint8Array,
  remoteIdentity: Uint8Array
): Promise<RatchetState> {
  const { privateKey: dhPrivate, publicKey: dhPublic } = await generateECDHKeypair();

  // Derive shared secret from identity material using HKDF (simplified handshake)
  const combined = new Uint8Array(localIdentity.length + remoteIdentity.length);
  combined.set(localIdentity);
  combined.set(remoteIdentity, localIdentity.length);
  const salt = new Uint8Array(KEY_LENGTH);
  const info = new TextEncoder().encode('DoubleRatchetInit');
  const sharedSecret = await hkdf(combined, salt, info, KEY_LENGTH * 2);

  return {
    dhPrivate,
    dhPublic,
    rootKey: sharedSecret.slice(0, KEY_LENGTH),
    sentChainKey: sharedSecret.slice(KEY_LENGTH),
    receivedChainKey: null,
    sentMessageNumber: 0,
    receivedMessageNumber: 0,
    skippedKeys: new Map(),
    lastRemotePublic: null,
    createdAt: Date.now(),
    lastRatchetAt: Date.now(),
  };
}

export async function initializeRatchetFromFirstMessage(
  _localIdentity: Uint8Array,
  remoteIdentity: Uint8Array,
  initiatorPublic: Uint8Array
): Promise<RatchetState> {
  const { privateKey: dhPrivate, publicKey: dhPublic } = await generateECDHKeypair();

  // Derive same shared secret as initiator using identity material
  const combined = new Uint8Array(remoteIdentity.length + _localIdentity.length);
  combined.set(remoteIdentity);
  combined.set(_localIdentity, remoteIdentity.length);
  const salt = new Uint8Array(KEY_LENGTH);
  const info = new TextEncoder().encode('DoubleRatchetInit');
  const sharedSecret = await hkdf(combined, salt, info, KEY_LENGTH * 2);

  return {
    dhPrivate,
    dhPublic,
    rootKey: sharedSecret.slice(0, KEY_LENGTH),
    sentChainKey: sharedSecret.slice(KEY_LENGTH),
    receivedChainKey: sharedSecret.slice(KEY_LENGTH), // Same as initiator's sent chain
    sentMessageNumber: 0,
    receivedMessageNumber: 0,
    skippedKeys: new Map(),
    lastRemotePublic: initiatorPublic,
    createdAt: Date.now(),
    lastRatchetAt: Date.now(),
  };
}

export async function ratchetForSend(state: RatchetState): Promise<{
  keys: RatchetKeys;
  messageNumber: number;
  dhPublic: Uint8Array;
}> {
  if (!state.sentChainKey) {
    throw new Error('Cannot send: no chain key available');
  }

  // Perform DH ratchet if we have received a message with a DH key and haven't ratcheted yet
  if (state.lastRemotePublic && state.receivedChainKey && state.sentMessageNumber === 0) {
    const dhOutput = await performECDH(state.dhPrivate, state.lastRemotePublic);
    const { rootKey: newRoot, chainKey: newSendChain } = await deriveChainKeys(
      state.rootKey,
      dhOutput
    );
    state.rootKey = newRoot;
    state.sentChainKey = newSendChain;
  }

  const { keys, nextChainKey } = await deriveMessageKeys(state.sentChainKey);
  state.sentChainKey = nextChainKey;
  state.sentMessageNumber++;
  state.lastRatchetAt = Date.now();

  return {
    keys,
    messageNumber: state.sentMessageNumber,
    dhPublic: state.dhPublic,
  };
}

export async function ratchetForReceive(
  state: RatchetState,
  dhPublic: Uint8Array,
  messageNumber: number
): Promise<{
  keys: RatchetKeys;
  skipped: boolean;
}> {
  const keyId = `${messageNumber}`;
  if (state.skippedKeys.has(keyId)) {
    const messageKey = state.skippedKeys.get(keyId)!;
    state.skippedKeys.delete(keyId);

    const keys = await hkdf(
      messageKey,
      new Uint8Array(KEY_LENGTH),
      new TextEncoder().encode('MessageKeys'),
      KEY_LENGTH + MAC_KEY_LENGTH
    );

    return {
      keys: {
        encryptionKey: keys.slice(0, KEY_LENGTH),
        macKey: keys.slice(KEY_LENGTH),
      },
      skipped: true,
    };
  }

  // DH ratchet step when receiving a message with a new DH public key
  if (dhPublic && (!state.lastRemotePublic || !arraysEqual(dhPublic, state.lastRemotePublic))) {
    const dhOutput = await performECDH(state.dhPrivate, dhPublic);
    
    // First DH exchange derives the new received chain key
    const { rootKey: newRootKey1, chainKey: newReceivedChain } = await deriveChainKeys(
      state.rootKey,
      dhOutput
    );
    state.rootKey = newRootKey1;
    state.receivedChainKey = newReceivedChain;

    // Generate new ephemeral key pair for sending
    const { privateKey: newDhPrivate, publicKey: newDhPublic } = await generateECDHKeypair();
    state.dhPrivate = newDhPrivate;
    state.dhPublic = newDhPublic;

    // Second DH exchange with new key derives the new sent chain key
    const dhOutput2 = await performECDH(state.dhPrivate, dhPublic);
    const { rootKey: finalRoot, chainKey: sentChain } = await deriveChainKeys(
      state.rootKey,
      dhOutput2
    );
    state.rootKey = finalRoot;
    state.sentChainKey = sentChain;

    state.lastRemotePublic = dhPublic;
  }

  if (!state.receivedChainKey) {
    throw new Error('Cannot receive: no chain key available');
  }

  if (messageNumber < state.receivedMessageNumber) {
    throw new Error('Message already received or too old');
  }

  if (messageNumber > state.receivedMessageNumber + MAX_SKIP) {
    throw new Error('Message number too far ahead');
  }

  // Advance chain key to the target message position, storing skipped keys
  let chainKey = state.receivedChainKey;
  const messagesToSkip = messageNumber - state.receivedMessageNumber - 1;
  for (let i = 0; i < messagesToSkip; i++) {
    const { messageKey, nextChainKey } = await advanceChainKey(chainKey);
    const skipKeyId = `${state.receivedMessageNumber + 1}`;
    state.skippedKeys.set(skipKeyId, messageKey);
    chainKey = nextChainKey;
    state.receivedMessageNumber++;
  }

  // Advance to target message position and derive keys
  const { messageKey, nextChainKey } = await advanceChainKey(chainKey);
  const keys = await deriveMessageKeysFromMessageKey(messageKey);
  state.receivedChainKey = nextChainKey;
  state.receivedMessageNumber = messageNumber + 1;

  return { keys, skipped: messagesToSkip > 0 };
}

function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export async function encryptMessage(
  keys: RatchetKeys,
  plaintext: string,
  associatedData?: Uint8Array
): Promise<{ ciphertext: Uint8Array; mac: Uint8Array; iv: Uint8Array }> {
  const iv = generateRandomBytes(12);
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keys.encryptionKey as BufferSource,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      tagLength: 128,
      additionalData: associatedData as BufferSource | undefined,
    },
    cryptoKey,
    data
  );

  const encryptedBytes = new Uint8Array(encrypted);
  const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - 16);
  const mac = encryptedBytes.slice(encryptedBytes.length - 16);

  return { ciphertext, mac, iv };
}

export async function decryptMessage(
  keys: RatchetKeys,
  ciphertext: Uint8Array,
  mac: Uint8Array,
  iv: Uint8Array,
  associatedData?: Uint8Array
): Promise<string> {
  const encryptedData = new Uint8Array(ciphertext.length + mac.length);
  encryptedData.set(ciphertext);
  encryptedData.set(mac, ciphertext.length);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keys.encryptionKey as BufferSource,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      tagLength: 128,
      additionalData: associatedData as BufferSource | undefined,
    },
    cryptoKey,
    encryptedData
  );

  return new TextDecoder().decode(decrypted);
}

export async function serializeRatchetState(state: RatchetState): Promise<string> {
  const dhPrivateJwk = await crypto.subtle.exportKey('jwk', state.dhPrivate);
  return JSON.stringify({
    dhPrivate: dhPrivateJwk,
    dhPublic: Array.from(state.dhPublic),
    rootKey: Array.from(state.rootKey),
    sentChainKey: state.sentChainKey ? Array.from(state.sentChainKey) : null,
    receivedChainKey: state.receivedChainKey ? Array.from(state.receivedChainKey) : null,
    sentMessageNumber: state.sentMessageNumber,
    receivedMessageNumber: state.receivedMessageNumber,
    skippedKeys: Array.from(state.skippedKeys.entries()).map(([k, v]) => [k, Array.from(v)]),
    lastRemotePublic: state.lastRemotePublic ? Array.from(state.lastRemotePublic) : null,
    createdAt: state.createdAt,
    lastRatchetAt: state.lastRatchetAt,
  });
}

export async function deserializeRatchetState(data: string): Promise<RatchetState> {
  const parsed = JSON.parse(data);
  const dhPrivate = await crypto.subtle.importKey(
    'jwk', parsed.dhPrivate, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']
  );
  return {
    dhPrivate,
    dhPublic: new Uint8Array(parsed.dhPublic),
    rootKey: new Uint8Array(parsed.rootKey),
    sentChainKey: parsed.sentChainKey ? new Uint8Array(parsed.sentChainKey) : null,
    receivedChainKey: parsed.receivedChainKey ? new Uint8Array(parsed.receivedChainKey) : null,
    sentMessageNumber: parsed.sentMessageNumber,
    receivedMessageNumber: parsed.receivedMessageNumber,
    skippedKeys: new Map(
      parsed.skippedKeys.map((entry: [string, number[]]) => [entry[0], new Uint8Array(entry[1])])
    ),
    lastRemotePublic: parsed.lastRemotePublic ? new Uint8Array(parsed.lastRemotePublic) : null,
    createdAt: parsed.createdAt,
    lastRatchetAt: parsed.lastRatchetAt,
  };
}

export function getRatchetPublicKey(state: RatchetState): Uint8Array {
  return state.dhPublic;
}
