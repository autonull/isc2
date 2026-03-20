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

const DEFAULT_CONFIG: MultilingualConfig = {
  enabled: true,
  targetLanguage: 'en',
  autoTranslate: true,
  showOriginal: true,
  storageKey: 'isc:multilingual',
};

export class MultilingualService {
  private config: MultilingualConfig;
  private translationCache = new Map<string, TranslationResult>();
  private languageDetectionCache = new Map<string, string>();
  private listeners: Set<(config: MultilingualConfig) => void> = new Set();
  private translationService: ((text: string, from: string, to: string) => Promise<string>) | null =
    null;

  constructor(config: Partial<MultilingualConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadFromStorage();
  }

  start(): void {
    console.log('[Multilingual] Starting with config:', this.config);
  }

  detectLanguage(text: string): string {
    if (this.languageDetectionCache.has(text)) return this.languageDetectionCache.get(text)!;

    for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
      if (patterns.some((p) => p.test(text))) {
        this.languageDetectionCache.set(text, lang);
        return lang;
      }
    }

    const lowerText = text.toLowerCase();
    let maxScore = 0;
    let detectedLang = 'en';

    for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
      const score = patterns.filter((p) => p.test(lowerText)).length;
      if (score > maxScore) {
        maxScore = score;
        detectedLang = lang;
      }
    }

    this.languageDetectionCache.set(text, detectedLang);
    return detectedLang;
  }

  async translate(text: string, targetLang?: string): Promise<TranslationResult> {
    const sourceLang = this.detectLanguage(text);
    const target = targetLang ?? this.config.targetLanguage;

    if (sourceLang === target)
      return {
        original: text,
        translated: text,
        sourceLanguage: sourceLang,
        targetLanguage: target,
        confidence: 1,
      };

    const cacheKey = `${sourceLang}:${target}:${text}`;
    if (this.translationCache.has(cacheKey)) return this.translationCache.get(cacheKey)!;

    let translated = text;
    let confidence = 0.5;

    if (this.translationService) {
      try {
        translated = await this.translationService(text, sourceLang, target);
        confidence = 0.9;
      } catch (err) {
        console.warn('[Multilingual] Translation service failed:', err);
      }
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

  async translateBatch(texts: string[], targetLang?: string): Promise<TranslationResult[]> {
    return Promise.all(texts.map((text) => this.translate(text, targetLang)));
  }

  getDisplayText(text: string, sourceLang?: string) {
    if (!this.config.enabled || !this.config.autoTranslate)
      return { primary: text, showTranslation: false };

    const detectedLang = sourceLang ?? this.detectLanguage(text);
    return { primary: text, showTranslation: detectedLang !== this.config.targetLanguage };
  }

  setTargetLanguage(langCode: string): void {
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
    if (!lang) {
      console.warn('[Multilingual] Unsupported language:', langCode);
      return;
    }
    this.config.targetLanguage = langCode;
    this.saveToStorage();
    this.emitUpdate();
  }

  toggleAutoTranslate(): void {
    this.config.autoTranslate = !this.config.autoTranslate;
    this.saveToStorage();
    this.emitUpdate();
  }

  toggleShowOriginal(): void {
    this.config.showOriginal = !this.config.showOriginal;
    this.saveToStorage();
    this.emitUpdate();
  }

  getSupportedLanguages(): Language[] {
    return SUPPORTED_LANGUAGES;
  }

  getCurrentLanguage(): Language | undefined {
    return SUPPORTED_LANGUAGES.find((l) => l.code === this.config.targetLanguage);
  }

  onUpdate(callback: (config: MultilingualConfig) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  setTranslationService(
    service: (text: string, from: string, to: string) => Promise<string>
  ): void {
    this.translationService = service;
  }

  clearCache(): void {
    this.translationCache.clear();
    this.languageDetectionCache.clear();
  }

  getStatus() {
    return {
      enabled: this.config.enabled,
      targetLanguage: this.getCurrentLanguage(),
      autoTranslate: this.config.autoTranslate,
      cacheSize: this.translationCache.size,
    };
  }

  configure(updates: Partial<MultilingualConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveToStorage();
    this.emitUpdate();
  }

  private emitUpdate(): void {
    this.listeners.forEach((listener) => listener({ ...this.config }));
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (!stored) return;
      this.config = { ...this.config, ...JSON.parse(stored) };
    } catch (err) {
      console.warn('[Multilingual] Failed to load config:', err);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(
        this.config.storageKey,
        JSON.stringify({
          targetLanguage: this.config.targetLanguage,
          autoTranslate: this.config.autoTranslate,
          showOriginal: this.config.showOriginal,
        })
      );
    } catch (err) {
      console.warn('[Multilingual] Failed to save config:', err);
    }
  }
}

let _instance: MultilingualService | null = null;

export function getMultilingualService(config?: Partial<MultilingualConfig>): MultilingualService {
  if (!_instance) _instance = new MultilingualService(config);
  return _instance;
}
