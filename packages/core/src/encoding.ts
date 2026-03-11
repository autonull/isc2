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
