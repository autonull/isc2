export {
  generateKeypair,
  exportKeypair,
  importKeypair,
  formatKeyFingerprint,
  type Keypair,
  type Signature,
  type PublicKey,
} from './keypair.js';

export { sign, verify, signObject, verifyObject } from './signing.js';

export {
  deriveKeyFromPassphrase,
  encryptPrivateKey,
  decryptPrivateKey,
  validatePassphraseStrength,
  encrypt,
  decrypt,
  type EncryptedKeypair,
} from './encryption.js';

// Phase 8: Advanced Cryptography
export {
  // Ephemeral identities
  createEphemeralIdentity,
  isEphemeralIdentityValid,
  useEphemeralIdentity,
  getRemainingUses,
  getRemainingLifetime,
  exportEphemeralIdentity,
  importEphemeralIdentity,
  rotateEphemeralIdentity,
  createEphemeralIdentitiesBatch,
  getEphemeralStats,
  cleanupExpiredIdentities,
  deriveEphemeralIdentity,
  type EphemeralIdentity,
  type EphemeralConfig,
} from './ephemeral.js';

export {
  // Shamir's Secret Sharing
  splitSecret,
  reconstructSecret,
  exportShare,
  importShare,
  exportShares,
  importShares,
  validateShares,
  createKeyBackup,
  recoverKeyFromBackup,
  generateRecoveryCodes,
  verifyShareIntegrity,
  type SecretShare,
  type ShamirConfig,
} from './shamir.js';

export {
  // IP Protection
  hashIPAddress,
  extractCoarseLocation,
  detectNATType,
  createIPMetadata,
  selectRelayNodes,
  createCircuit,
  isCircuitValid,
  anonymizeRequestMetadata,
  generateNoiseTraffic,
  isDatacenterIP,
  getNetworkFingerprint,
  ConnectionRateLimiter,
  ConnectionPool,
  type IPMetadata,
  type RelayNode,
  type Circuit,
  type IPProtectionConfig,
} from './ip-protection.js';
