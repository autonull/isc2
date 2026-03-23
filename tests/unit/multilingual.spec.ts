import { describe, it, expect } from 'vitest';

describe('MultilingualService', () => {
  it('should export getMultilingualService function', async () => {
    const { getMultilingualService } =
      await import('../../../../apps/browser/src/services/multilingual.ts');
    expect(typeof getMultilingualService).toBe('function');
  });

  it('should export MultilingualService class', async () => {
    const { MultilingualService } =
      await import('../../../../apps/browser/src/services/multilingual.ts');
    expect(typeof MultilingualService).toBe('function');
  });

  it('should have getCurrentLanguage method on instance', async () => {
    const { getMultilingualService } =
      await import('../../../../apps/browser/src/services/multilingual.ts');
    const service = getMultilingualService();
    expect(typeof service.getCurrentLanguage).toBe('function');
  });

  it('should have detectLanguage method on instance', async () => {
    const { getMultilingualService } =
      await import('../../../../apps/browser/src/services/multilingual.ts');
    const service = getMultilingualService();
    expect(typeof service.detectLanguage).toBe('function');
  });

  it('should handle invalid language code gracefully', async () => {
    const { getMultilingualService } =
      await import('../../../../apps/browser/src/services/multilingual.ts');
    const service = getMultilingualService();
    const lang = service.detectLanguage('invalid-language-code-12345');
    expect(typeof lang).toBe('string');
  });

  it('should return English for English text', async () => {
    const { getMultilingualService } =
      await import('../../../../apps/browser/src/services/multilingual.ts');
    const service = getMultilingualService();
    const lang = service.detectLanguage('hello world');
    expect(lang).toBe('en');
  });

  it('should return Spanish for Spanish text', async () => {
    const { getMultilingualService } =
      await import('../../../../apps/browser/src/services/multilingual.ts');
    const service = getMultilingualService();
    const lang = service.detectLanguage('hola mundo el la');
    expect(lang).toBe('es');
  });
});
