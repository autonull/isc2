import { generateKeypair, exportKeypair, importKeypair, formatKeyFingerprint } from '@isc/core';

export interface IdentityManager {
  keypair: CryptoKeyPair | null;
  publicKeyFingerprint: string | null;
  isInitialized: boolean;
}

let identityState: IdentityManager = {
  keypair: null,
  publicKeyFingerprint: null,
  isInitialized: false,
};

const setIdentityState = (keypair: CryptoKeyPair): IdentityManager => ({
  keypair,
  publicKeyFingerprint: null,
  isInitialized: true,
});

export async function initializeIdentity(_passphrase?: string): Promise<IdentityManager> {
  const existingKeypair = await loadStoredKeypair();

  if (existingKeypair) {
    identityState = setIdentityState(existingKeypair);
    identityState.publicKeyFingerprint = await formatKeyFingerprint(existingKeypair.publicKey);
    return identityState;
  }

  const keypair = await generateKeypair();
  await storeKeypair(await exportKeypair(keypair));
  identityState = setIdentityState(keypair);
  identityState.publicKeyFingerprint = await formatKeyFingerprint(keypair.publicKey);

  return identityState;
}

export async function generateNewIdentity(): Promise<IdentityManager> {
  const keypair = await generateKeypair();
  await storeKeypair(await exportKeypair(keypair));
  identityState = setIdentityState(keypair);
  identityState.publicKeyFingerprint = await formatKeyFingerprint(keypair.publicKey);
  return identityState;
}

export const getIdentity = (): IdentityManager => identityState;

const loadStoredKeypair = async (): Promise<CryptoKeyPair | null> => {
  try {
    const stored = localStorage.getItem('isc_keypair');
    if (!stored) return null;
    const { publicKey, privateKey } = JSON.parse(stored);
    return await importKeypair(new Uint8Array(publicKey), new Uint8Array(privateKey));
  } catch (error) {
    console.error('Failed to load stored keypair:', error);
    return null;
  }
};

const storeKeypair = async (exported: {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}): Promise<void> => {
  localStorage.setItem(
    'isc_keypair',
    JSON.stringify({
      publicKey: Array.from(exported.publicKey),
      privateKey: Array.from(exported.privateKey),
    })
  );
};

export const exportIdentity = (): string => localStorage.getItem('isc_keypair') || '';

export async function importIdentity(keypairJson: string): Promise<IdentityManager> {
  const { publicKey, privateKey } = JSON.parse(keypairJson);
  const keypair = await importKeypair(new Uint8Array(publicKey), new Uint8Array(privateKey));
  await storeKeypair({
    publicKey: new Uint8Array(publicKey),
    privateKey: new Uint8Array(privateKey),
  });
  identityState = setIdentityState(keypair);
  identityState.publicKeyFingerprint = await formatKeyFingerprint(keypair.publicKey);
  return identityState;
}
