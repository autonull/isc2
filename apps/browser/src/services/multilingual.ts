/**
 * Multilingual Support Service
 *
 * Real-time translation for cross-language communication.
 * Uses browser's Intl API and optional external translation service.
 *
 * Features:
 * - Auto-detect message language
 * - Translate posts/messages on-the-fly
 * - Language preference storage
 * - Fallback to English when translation unavailable
 */

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export interface TranslationResult {
  original: string;
  translated: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
}

export interface MultilingualConfig {
  enabled: boolean;
  targetLanguage: string;
  autoTranslate: boolean;
  showOriginal: boolean;
  storageKey: string;
}

const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
];

const DEFAULT_CONFIG: MultilingualConfig = {
  enabled: true,
  targetLanguage: 'en',
  autoTranslate: true,
  showOriginal: true,
  storageKey: 'isc:multilingual',
};

// Common phrases for quick language detection
const LANGUAGE_PATTERNS: Record<string, RegExp[]> = {
  es: [/^[¡¿]/, /\b(el|la|los|las|un|una|de|que|en|es|por|con)\b/i],
  fr: [/^[«»]/, /\b(le|la|les|un|une|de|que|dans|est|pour|avec)\b/i],
  de: [/^[„"]/, /\b(der|die|das|ein|eine|von|dass|in|ist|für|mit)\b/i],
  it: [/^[«»]/, /\b(il|la|i|le|un|una|di|che|in|è|per|con)\b/i],
  pt: [/^[«»]/, /\b(o|a|os|as|um|uma|de|que|em|é|por|com)\b/i],
  ru: [/[\u0400-\u04FF]/],
  ja: [/[\u3040-\u309F\u30A0-\u30FF]/],
  ko: [/[\uAC00-\uD7AF]/],
  zh: [/[\u4E00-\u9FFF]/],
  ar: [/[\u0600-\u06FF]/],
  hi: [/[\u0900-\u097F]/],
};

export class MultilingualService {
  private config: MultilingualConfig;
  private translationCache = new Map<string, TranslationResult>();
  private languageDetectionCache = new Map<string, string>();
  private listeners: Set<(config: MultilingualConfig) => void> = new Set();
  private translationService: ((text: string, from: string, to: string) => Promise<string>) | null = null;

  constructor(config: Partial<MultilingualConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadFromStorage();
  }

  /**
   * Initialize multilingual service
   */
  start(): void {
    console.log('[Multilingual] Starting with config:', this.config);
  }

  /**
   * Detect language of text
   */
  detectLanguage(text: string): string {
    // Check cache
    if (this.languageDetectionCache.has(text)) {
      return this.languageDetectionCache.get(text)!;
    }

    // Check for script-specific characters first
    for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          this.languageDetectionCache.set(text, lang);
          return lang;
        }
      }
    }

    // Fallback: check common words
    const lowerText = text.toLowerCase();
    let maxScore = 0;
    let detectedLang = 'en';

    for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(lowerText)) {
          score++;
        }
      }
      if (score > maxScore) {
        maxScore = score;
        detectedLang = lang;
      }
    }

    this.languageDetectionCache.set(text, detectedLang);
    return detectedLang;
  }

  /**
   * Translate text
   */
  async translate(text: string, targetLang?: string): Promise<TranslationResult> {
    const sourceLang = this.detectLanguage(text);
    const target = targetLang || this.config.targetLanguage;

    // No translation needed
    if (sourceLang === target) {
      return {
        original: text,
        translated: text,
        sourceLanguage: sourceLang,
        targetLanguage: target,
        confidence: 1,
      };
    }

    // Check cache
    const cacheKey = `${sourceLang}:${target}:${text}`;
    if (this.translationCache.has(cacheKey)) {
      return this.translationCache.get(cacheKey)!;
    }

    let translated = text;
    let confidence = 0.5;

    // Try custom translation service if available
    if (this.translationService) {
      try {
        translated = await this.translationService(text, sourceLang, target);
        confidence = 0.9;
      } catch (err) {
        console.warn('[Multilingual] Translation service failed:', err);
      }
    }

    // Fallback: use browser's Intl for basic support
    if (translated === text && typeof Intl !== 'undefined') {
      // Note: Intl.DisplayNames doesn't translate arbitrary text
      // This is a placeholder for future browser translation API
      translated = text;
    }

    const result: TranslationResult = {
      original: text,
      translated,
      sourceLanguage: sourceLang,
      targetLanguage: target,
      confidence,
    };

    this.translationCache.set(cacheKey, result);
    return result;
  }

  /**
   * Translate multiple texts in batch
   */
  async translateBatch(texts: string[], targetLang?: string): Promise<TranslationResult[]> {
    return Promise.all(texts.map(text => this.translate(text, targetLang)));
  }

  /**
   * Get display text (translated or original based on settings)
   */
  getDisplayText(text: string, sourceLang?: string): {
    primary: string;
    secondary?: string;
    showTranslation: boolean;
  } {
    if (!this.config.enabled || !this.config.autoTranslate) {
      return { primary: text, showTranslation: false };
    }

    const detectedLang = sourceLang || this.detectLanguage(text);
    
    if (detectedLang === this.config.targetLanguage) {
      return { primary: text, showTranslation: false };
    }

    // For async translation, return original immediately
    // Component should call translate() separately for actual translation
    return {
      primary: text,
      showTranslation: detectedLang !== this.config.targetLanguage,
    };
  }

  /**
   * Set target language
   */
  setTargetLanguage(langCode: string): void {
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === langCode);
    if (!lang) {
      console.warn('[Multilingual] Unsupported language:', langCode);
      return;
    }

    this.config.targetLanguage = langCode;
    this.saveToStorage();
    this.emitUpdate();
    console.log('[Multilingual] Target language set to:', lang.name);
  }

  /**
   * Toggle auto-translate
   */
  toggleAutoTranslate(): void {
    this.config.autoTranslate = !this.config.autoTranslate;
    this.saveToStorage();
    this.emitUpdate();
  }

  /**
   * Toggle show original
   */
  toggleShowOriginal(): void {
    this.config.showOriginal = !this.config.showOriginal;
    this.saveToStorage();
    this.emitUpdate();
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): Language[] {
    return SUPPORTED_LANGUAGES;
  }

  /**
   * Get current language
   */
  getCurrentLanguage(): Language | undefined {
    return SUPPORTED_LANGUAGES.find(l => l.code === this.config.targetLanguage);
  }

  /**
   * Subscribe to config updates
   */
  onUpdate(callback: (config: MultilingualConfig) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Set custom translation service
   */
  setTranslationService(
    service: (text: string, from: string, to: string) => Promise<string>
  ): void {
    this.translationService = service;
  }

  /**
   * Clear translation cache
   */
  clearCache(): void {
    this.translationCache.clear();
    this.languageDetectionCache.clear();
  }

  /**
   * Get service status
   */
  getStatus(): {
    enabled: boolean;
    targetLanguage: Language | undefined;
    autoTranslate: boolean;
    cacheSize: number;
  } {
    return {
      enabled: this.config.enabled,
      targetLanguage: this.getCurrentLanguage(),
      autoTranslate: this.config.autoTranslate,
      cacheSize: this.translationCache.size,
    };
  }

  /**
   * Update configuration
   */
  configure(updates: Partial<MultilingualConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveToStorage();
    this.emitUpdate();
    console.log('[Multilingual] Config updated:', this.config);
  }

  private emitUpdate(): void {
    this.listeners.forEach(listener => listener({ ...this.config }));
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (!stored) return;

      const parsed = JSON.parse(stored);
      this.config = {
        ...this.config,
        ...parsed,
      };
    } catch {
      // Ignore storage errors
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify({
        targetLanguage: this.config.targetLanguage,
        autoTranslate: this.config.autoTranslate,
        showOriginal: this.config.showOriginal,
      }));
    } catch (err) {
      console.warn('[Multilingual] Failed to save config:', err);
    }
  }
}

// Singleton instance
let _instance: MultilingualService | null = null;

export function getMultilingualService(config?: Partial<MultilingualConfig>): MultilingualService {
  if (!_instance) {
    _instance = new MultilingualService(config);
  }
  return _instance;
}
