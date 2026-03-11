/**
 * Encodes a JavaScript object to Uint8Array using CBOR-like binary encoding.
 * Falls back to JSON for debugging and compatibility.
 *
 * @param obj - Object to encode
 * @returns Encoded bytes
 *
 * @example
 * ```typescript
 * const data = { name: 'Alice', age: 30 };
 * const encoded = encode(data);
 * // encoded = Uint8Array([...])
 * ```
 */
export declare function encode(obj: unknown): Uint8Array;
/**
 * Decodes Uint8Array to a JavaScript object.
 *
 * @param data - Encoded bytes
 * @returns Decoded object
 *
 * @example
 * ```typescript
 * const decoded = decode(encoded);
 * // decoded = { name: 'Alice', age: 30 }
 * ```
 */
export declare function decode(data: Uint8Array): unknown;
/**
 * Type-safe decode that asserts the result type.
 *
 * @param data - Encoded bytes
 * @returns Decoded object typed as T
 * @throws Error if decoding fails or type assertion fails
 */
export declare function decodeAs<T>(data: Uint8Array): T;
/**
 * Encodes a string to Uint8Array.
 */
export declare function encodeString(str: string): Uint8Array;
/**
 * Decodes Uint8Array to a string.
 */
export declare function decodeString(data: Uint8Array): string;
//# sourceMappingURL=encoding.d.ts.map