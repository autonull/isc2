export function encode(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj));
}

export function decode(data: Uint8Array): unknown {
  return JSON.parse(new TextDecoder().decode(data));
}
