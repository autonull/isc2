/**
 * Cryptographic keypair interface.
 */
export interface Keypair {
    publicKey: CryptoKey;
    privateKey: CryptoKey;
}
/**
 * Digital signature interface.
 */
export interface Signature {
    data: Uint8Array;
    algorithm: 'Ed25519';
}
/**
 * Generates an Ed25519 keypair using the Web Crypto API.
 *
 * @returns Generated keypair
 * @throws Error if Web Crypto API is unavailable or Ed25519 is unsupported
 *
 * @example
 * ```typescript
 * const keypair = await generateKeypair();
 * // keypair.publicKey - Public key for verification
 * // keypair.privateKey - Private key for signing
 * ```
 */
export declare function generateKeypair(): Promise<Keypair>;
/**
 * Exports a keypair to a portable format for storage or transmission.
 *
 * @param keypair - Keypair to export
 * @returns Object with exported key data
 */
export declare function exportKeypair(keypair: Keypair): Promise<{
    publicKey: Uint8Array;
    privateKey: Uint8Array;
}>;
/**
 * Imports a keypair from exported format.
 *
 * @param publicKey - Exported public key bytes
 * @param privateKey - Exported private key bytes
 * @returns Imported keypair
 */
export declare function importKeypair(publicKey: Uint8Array, privateKey: Uint8Array): Promise<Keypair>;
/**
 * Formats a public key as a human-readable fingerprint.
 *
 * @param publicKey - Public key to format
 * @returns Base58-encoded fingerprint (first 16 chars)
 */
export declare function formatKeyFingerprint(publicKey: CryptoKey): Promise<string>;
//# sourceMappingURL=keypair.d.ts.map