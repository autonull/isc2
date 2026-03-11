const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encode(obj: unknown): Uint8Array {
  const json = JSON.stringify(obj, (_key, value) =>
    value instanceof Uint8Array ? { __type: 'Uint8Array', data: Array.from(value) } : value
  );
  return encoder.encode(json);
}

export function decode(data: Uint8Array): unknown {
  return JSON.parse(decoder.decode(data), (_key, value) =>
    value?.__type === 'Uint8Array' ? new Uint8Array(value.data) : value
  );
}

export function decodeAs<T>(data: Uint8Array): T {
  return decode(data) as T;
}

export const encodeString = (str: string): Uint8Array => encoder.encode(str);
export const decodeString = (data: Uint8Array): string => decoder.decode(data);

/**
 * Generate a UUID v4 string
 */
export function generateUUID(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
