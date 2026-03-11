import { describe, it, expect } from 'vitest';
import { BrowserStorage } from '../src/browser/storage.js';

describe('BrowserStorage', () => {
  describe('construction', () => {
    it('should create a new instance', () => {
      const storage = new BrowserStorage();
      expect(storage).toBeDefined();
      expect(storage).toBeInstanceOf(BrowserStorage);
    });
  });

  describe('interface', () => {
    it('should have required methods', () => {
      const storage = new BrowserStorage();
      expect(typeof storage.init).toBe('function');
      expect(typeof storage.get).toBe('function');
      expect(typeof storage.set).toBe('function');
      expect(typeof storage.delete).toBe('function');
      expect(typeof storage.keys).toBe('function');
      expect(typeof storage.clear).toBe('function');
    });
  });
});
