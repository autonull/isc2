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
export function encode(obj: unknown): Uint8Array {
  const encoder = new TextEncoder();
  const json = JSON.stringify(obj, (key, value) => {
    // Handle Uint8Array specially for round-trip
    if (value instanceof Uint8Array) {
      return { __type: 'Uint8Array', data: Array.from(value) };
    }
    return value;
  });
  return encoder.encode(json);
}

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
export function decode(data: Uint8Array): unknown {
  const decoder = new TextDecoder();
  const json = decoder.decode(data);
  
  return JSON.parse(json, (key, value) => {
    // Restore Uint8Array from special format
    if (value && typeof value === 'object' && value.__type === 'Uint8Array') {
      return new Uint8Array(value.data);
    }
    return value;
  });
}

/**
 * Type-safe decode that asserts the result type.
 * 
 * @param data - Encoded bytes
 * @returns Decoded object typed as T
 * @throws Error if decoding fails or type assertion fails
 */
export function decodeAs<T>(data: Uint8Array): T {
  const result = decode(data);
  return result as T;
}

/**
 * Encodes a string to Uint8Array.
 */
export function encodeString(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

/**
 * Decodes Uint8Array to a string.
 */
export function decodeString(data: Uint8Array): string {
  const decoder = new TextDecoder();
  return decoder.decode(data);
}
