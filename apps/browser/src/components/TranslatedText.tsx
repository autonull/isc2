/**
 * Translated Text Component
 *
 * Displays text with optional translation.
 * Shows original and translated text with toggle.
 */

import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { getMultilingualService, type TranslationResult } from '../services/multilingual.js';

interface TranslatedTextProps {
  text: string;
  sourceLanguage?: string;
  maxLength?: number;
  showTranslateButton?: boolean;
  className?: string;
}

export function TranslatedText({
  text,
  sourceLanguage,
  maxLength,
  showTranslateButton = true,
  className = '',
}: TranslatedTextProps) {
  const [service] = useState(() => getMultilingualService());
  const [translation, setTranslation] = useState<TranslationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showOriginal, setShowOriginal] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const config = service.getStatus();

  // Truncate text if needed
  const displayText = useCallback((str: string): string => {
    if (!maxLength || str.length <= maxLength) return str;
    if (isExpanded) return str;
    return str.slice(0, maxLength) + '...';
  }, [maxLength, isExpanded]);

  // Auto-translate on mount if enabled
  useEffect(() => {
    if (config.autoTranslate && config.enabled) {
      const detectedLang = sourceLanguage || service.detectLanguage(text);
      
      if (detectedLang !== config.targetLanguage?.code) {
        setIsLoading(true);
        service.translate(text).then(result => {
          setTranslation(result);
          setIsLoading(false);
        });
      }
    }
  }, [text, sourceLanguage, config.autoTranslate, config.enabled, config.targetLanguage, service]);

  const handleTranslate = useCallback(async () => {
    if (translation) {
      setShowOriginal(!showOriginal);
      return;
    }

    setIsLoading(true);
    try {
      const result = await service.translate(text);
      setTranslation(result);
      setShowOriginal(false);
    } finally {
      setIsLoading(false);
    }
  }, [translation, showOriginal, text, service]);

  const handleToggleExpand = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  // Determine if translation is needed
  const needsTranslation = translation && translation.sourceLanguage !== translation.targetLanguage;
  const currentText = showOriginal && needsTranslation ? translation.original : translation?.translated || text;

  return (
    <div class={`translated-text ${className}`}>
      <div class="text-content">
        {isLoading ? (
          <span class="text-loading">
            <span class="loading-dots">
              <span></span><span></span><span></span>
            </span>
            Translating...
          </span>
        ) : (
          <span class="text-body" onClick={handleToggleExpand}>
            {displayText(currentText)}
          </span>
        )}
        
        {maxLength && text.length > maxLength && (
          <button class="expand-button" onClick={handleToggleExpand}>
            {isExpanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {/* Translation controls */}
      {needsTranslation && showTranslateButton && (
        <div class="translation-controls">
          <button
            class="translate-button"
            onClick={handleTranslate}
            disabled={isLoading}
          >
            {showOriginal ? (
              <>
                <span class="translate-icon">🌐</span>
                <span>Translate to {translation.targetLanguage.toUpperCase()}</span>
              </>
            ) : (
              <>
                <span class="translate-icon">📝</span>
                <span>Show original ({translation.sourceLanguage.toUpperCase()})</span>
              </>
            )}
          </button>

          {/* Confidence indicator */}
          {translation.confidence < 0.8 && (
            <span class="confidence-warning" title="Translation confidence">
              ⚠️ {Math.round(translation.confidence * 100)}%
            </span>
          )}
        </div>
      )}

      {/* Language badge for non-translated content */}
      {!needsTranslation && sourceLanguage && sourceLanguage !== config.targetLanguage?.code && (
        <span class="language-badge">
          {sourceLanguage.toUpperCase()}
        </span>
      )}

      <style>{`
        .translated-text {
          display: inline-block;
          width: 100%;
        }

        .text-content {
          position: relative;
        }

        .text-body {
          color: var(--text-primary, #fff);
          line-height: 1.5;
          cursor: ${maxLength ? 'pointer' : 'default'};
        }

        .text-body:hover {
          color: var(--text-primary, #fff);
        }

        .text-loading {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--text-muted, #888);
          font-size: 13px;
        }

        .loading-dots {
          display: flex;
          gap: 3px;
        }

        .loading-dots span {
          width: 4px;
          height: 4px;
          background: var(--accent, #3b82f6);
          border-radius: 50%;
          animation: loading-bounce 1.4s infinite ease-in-out both;
        }

        .loading-dots span:nth-child(1) {
          animation-delay: -0.32s;
        }

        .loading-dots span:nth-child(2) {
          animation-delay: -0.16s;
        }

        @keyframes loading-bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }

        .expand-button {
          display: inline-block;
          margin-left: 4px;
          padding: 2px 6px;
          background: none;
          border: none;
          color: var(--accent, #3b82f6);
          font-size: 12px;
          cursor: pointer;
          text-decoration: underline;
        }

        .expand-button:hover {
          color: var(--accent-light, #60a5fa);
        }

        .translation-controls {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 6px;
        }

        .translate-button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 4px;
          color: var(--accent, #3b82f6);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .translate-button:hover {
          background: rgba(59, 130, 246, 0.2);
        }

        .translate-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .translate-icon {
          font-size: 12px;
        }

        .confidence-warning {
          font-size: 11px;
          color: var(--text-muted, #888);
        }

        .language-badge {
          display: inline-block;
          margin-left: 8px;
          padding: 2px 6px;
          background: var(--bg-tertiary, #0f0f1a);
          border-radius: 3px;
          font-size: 10px;
          color: var(--text-muted, #888);
          text-transform: uppercase;
        }
      `}</style>
    </div>
  );
}
