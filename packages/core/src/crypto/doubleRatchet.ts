/**
 * Double Ratchet Protocol Implementation
 *
 * Provides forward secrecy for conversations by rotating session keys.
 * Based on the Signal Protocol's Double Ratchet algorithm.
 *
 * This implementation uses ECDH for the DH ratchet and symmetric ratchet for message keys.
 */

export interface RatchetState {
  dhPrivate: Uint8Array;
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
  const hmacResult = await hmac(chainKey, chainKey);
  const messageKey = hmacResult.slice(0, KEY_LENGTH);
  const nextChainKey = hmacResult.slice(KEY_LENGTH);

  return { messageKey, nextChainKey };
}

async function deriveMessageKeys(
  chainKey: Uint8Array
): Promise<{ keys: RatchetKeys; nextChainKey: Uint8Array }> {
  const { messageKey, nextChainKey } = await kdfChainKey(chainKey);

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
    nextChainKey,
  };
}

async function performECDH(privateKey: Uint8Array, publicKey: Uint8Array): Promise<Uint8Array> {
  const privateCryptoKey = await crypto.subtle.importKey(
    'raw',
    privateKey.buffer as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits']
  );

  const publicCryptoKey = await crypto.subtle.importKey(
    'raw',
    publicKey.buffer as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicCryptoKey },
    privateCryptoKey,
    256
  );

  return new Uint8Array(derivedBits);
}

function deriveChainKeys(
  rootKey: Uint8Array,
  dhOutput: Uint8Array
): { rootKey: Uint8Array; chainKey: Uint8Array } {
  const combined = new Uint8Array(rootKey.length + dhOutput.length);
  combined.set(rootKey);
  combined.set(dhOutput, rootKey.length);

  const hashCombined = new Uint8Array(32);
  const seed = new TextEncoder().encode('Ratchet');
  for (let i = 0; i < 32; i++) {
    hashCombined[i] = combined[i] ^ seed[i % seed.length];
  }

  const rootKeyNew = hashCombined.slice(0, KEY_LENGTH);
  const chainKey = hashCombined.slice(KEY_LENGTH);

  return { rootKey: rootKeyNew, chainKey };
}

async function generateECDHKeypair(): Promise<{
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}> {
  const keyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);

  const publicKeyBuffer = await crypto.subtle.exportKey('raw', keyPair.publicKey);

  const privateKeyBuffer = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  const privateKey = new Uint8Array(32);
  const privateKeyJwk = privateKeyBuffer as JsonWebKey;
  if (privateKeyJwk.d) {
    const dBytes = base64UrlToBytes(privateKeyJwk.d);
    privateKey.set(dBytes.slice(0, 32));
  }

  return {
    privateKey,
    publicKey: new Uint8Array(publicKeyBuffer),
  };
}

function base64UrlToBytes(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function initializeRatchet(
  localIdentity: Uint8Array,
  remoteIdentity: Uint8Array
): Promise<RatchetState> {
  const { privateKey: dhPrivate, publicKey: dhPublic } = await generateECDHKeypair();

  const sharedSecret = await performECDH(localIdentity, remoteIdentity);

  const salt = generateRandomBytes(KEY_LENGTH);
  const info = new TextEncoder().encode('DoubleRatchet');
  const derived = await hkdf(sharedSecret, salt, info, KEY_LENGTH * 2);

  const rootKey = derived.slice(0, KEY_LENGTH);
  const { nextChainKey } = await deriveMessageKeys(rootKey);

  return {
    dhPrivate,
    dhPublic,
    rootKey,
    sentChainKey: nextChainKey,
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

  const sharedSecret = await performECDH(remoteIdentity, initiatorPublic);

  const salt = generateRandomBytes(KEY_LENGTH);
  const info = new TextEncoder().encode('DoubleRatchet');
  const derived = await hkdf(sharedSecret, salt, info, KEY_LENGTH * 2);

  const rootKey = derived.slice(0, KEY_LENGTH);
  const { nextChainKey } = await deriveMessageKeys(rootKey);

  return {
    dhPrivate,
    dhPublic,
    rootKey,
    sentChainKey: null,
    receivedChainKey: nextChainKey,
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

  if (dhPublic && (!state.lastRemotePublic || !arraysEqual(dhPublic, state.lastRemotePublic))) {
    const { rootKey: newRootKey, chainKey: newReceivedChain } = deriveChainKeys(
      state.rootKey,
      await performECDH(state.dhPrivate, dhPublic)
    );
    state.rootKey = newRootKey;
    state.receivedChainKey = newReceivedChain;

    const { privateKey: newDhPrivate, publicKey: newDhPublic } = await generateECDHKeypair();
    state.dhPrivate = newDhPrivate;
    state.dhPublic = newDhPublic;

    const { rootKey: finalRoot, chainKey: sentChain } = deriveChainKeys(
      state.rootKey,
      await performECDH(state.dhPrivate, dhPublic)
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

  let chainKey = state.receivedChainKey;
  while (state.receivedMessageNumber < messageNumber) {
    const { messageKey, nextChainKey } = await kdfChainKey(chainKey);
    const skipKeyId = `${state.receivedMessageNumber}`;
    state.skippedKeys.set(skipKeyId, messageKey);
    chainKey = nextChainKey;
    state.receivedMessageNumber++;
  }

  const { keys, nextChainKey } = await deriveMessageKeys(chainKey);
  state.receivedChainKey = nextChainKey;
  state.receivedMessageNumber = messageNumber + 1;

  return { keys, skipped: false };
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
    keys.encryptionKey.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv.buffer as ArrayBuffer,
      tagLength: 128,
      additionalData: associatedData?.buffer as ArrayBuffer,
    },
    cryptoKey,
    data.buffer as ArrayBuffer
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
    keys.encryptionKey.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv.buffer as ArrayBuffer,
      tagLength: 128,
      additionalData: associatedData?.buffer as ArrayBuffer,
    },
    cryptoKey,
    encryptedData.buffer as ArrayBuffer
  );

  return new TextDecoder().decode(decrypted);
}

export function serializeRatchetState(state: RatchetState): string {
  return JSON.stringify({
    dhPrivate: Array.from(state.dhPrivate),
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

export function deserializeRatchetState(data: string): RatchetState {
  const parsed = JSON.parse(data);
  return {
    dhPrivate: new Uint8Array(parsed.dhPrivate),
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
