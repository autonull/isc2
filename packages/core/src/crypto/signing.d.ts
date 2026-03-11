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
export declare function sign(payload: Uint8Array, privateKey: CryptoKey): Promise<Signature>;
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
export declare function verify(payload: Uint8Array, signature: Signature, publicKey: CryptoKey): Promise<boolean>;
/**
 * Signs a JSON-serializable object.
 *
 * @param obj - Object to sign (will be JSON-stringified)
 * @param privateKey - Private key for signing
 * @returns Object with original data and signature
 */
export declare function signObject<T extends Record<string, unknown>>(obj: T, privateKey: CryptoKey): Promise<T & {
    signature: string;
    timestamp: number;
}>;
/**
 * Verifies and extracts a signed object.
 *
 * @param signedObj - Signed object with signature field
 * @param publicKey - Public key for verification
 * @returns Original object without signature, or null if verification fails
 */
export declare function verifyObject<T extends Record<string, unknown>>(signedObj: T & {
    signature: string;
    timestamp: number;
}, publicKey: CryptoKey): Promise<T | null>;
//# sourceMappingURL=signing.d.ts.map