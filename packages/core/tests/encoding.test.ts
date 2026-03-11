import { describe, it, expect } from 'vitest';
import { encode, decode, decodeAs, encodeString, decodeString } from '../src/encoding.js';

describe('encoding', () => {
  describe('encode and decode', () => {
    it('should encode and decode a simple object', () => {
      const obj = { name: 'test', value: 123 };
      const encoded = encode(obj);
      const decoded = decode(encoded);

      expect(decoded).toEqual(obj);
    });

    it('should encode and decode nested objects', () => {
      const obj = {
        user: { name: 'Alice', age: 30 },
        tags: ['a', 'b', 'c'],
        count: 42,
      };
      const encoded = encode(obj);
      const decoded = decode(encoded);

      expect(decoded).toEqual(obj);
    });

    it('should handle Uint8Array', () => {
      const obj = { data: new Uint8Array([1, 2, 3, 4, 5]) };
      const encoded = encode(obj);
      const decoded = decode(encoded) as { data: Uint8Array };

      expect(decoded.data).toBeInstanceOf(Uint8Array);
      expect(Array.from(decoded.data)).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle arrays', () => {
      const obj = { items: [1, 2, 3], empty: [] };
      const encoded = encode(obj);
      const decoded = decode(encoded);

      expect(decoded).toEqual(obj);
    });

    it('should handle null and undefined', () => {
      const obj = { null: null, undef: undefined };
      const encoded = encode(obj);
      const decoded = decode(encoded);

      expect(decoded).toEqual({ null: null, undef: undefined });
    });

    it('should handle empty object', () => {
      const obj = {};
      const encoded = encode(obj);
      const decoded = decode(encoded);

      expect(decoded).toEqual({});
    });

    it('should handle numbers', () => {
      const obj = { int: 42, float: 3.14, negative: -10 };
      const encoded = encode(obj);
      const decoded = decode(encoded);

      expect(decoded).toEqual(obj);
    });

    it('should handle booleans', () => {
      const obj = { true: true, false: false };
      const encoded = encode(obj);
      const decoded = decode(encoded);

      expect(decoded).toEqual(obj);
    });

    it('should round-trip complex data structures', () => {
      const original = {
        channel: {
          id: 'ch_123',
          name: 'Test Channel',
          relations: [
            { tag: 'topic', weight: 1.5 },
            { tag: 'location', object: 'Tokyo', weight: 1.2 },
          ],
        },
        timestamp: Date.now(),
        signature: new Uint8Array([1, 2, 3, 4, 5]),
      };

      const encoded = encode(original);
      const decoded = decode(encoded) as typeof original;

      expect(decoded.channel.id).toBe(original.channel.id);
      expect(decoded.channel.relations).toEqual(original.channel.relations);
      expect(decoded.timestamp).toBe(original.timestamp);
      expect(decoded.signature).toBeInstanceOf(Uint8Array);
    });
  });

  describe('decodeAs', () => {
    it('should decode with type assertion', () => {
      interface TestType {
        name: string;
        value: number;
      }

      const obj: TestType = { name: 'test', value: 123 };
      const encoded = encode(obj);
      const decoded = decodeAs<TestType>(encoded);

      expect(decoded.name).toBe('test');
      expect(decoded.value).toBe(123);
    });
  });

  describe('encodeString and decodeString', () => {
    it('should encode and decode strings', () => {
      const str = 'Hello, World!';
      const encoded = encodeString(str);
      const decoded = decodeString(encoded);

      expect(decoded).toBe(str);
    });

    it('should handle unicode', () => {
      const str = 'Hello 🌍 你好 🔥';
      const encoded = encodeString(str);
      const decoded = decodeString(encoded);

      expect(decoded).toBe(str);
    });

    it('should handle empty string', () => {
      const str = '';
      const encoded = encodeString(str);
      const decoded = decodeString(encoded);

      expect(decoded).toBe('');
    });

    it('should produce correct byte length', () => {
      const str = 'Hello';
      const encoded = encodeString(str);

      expect(encoded.length).toBe(5);
    });
  });
});
