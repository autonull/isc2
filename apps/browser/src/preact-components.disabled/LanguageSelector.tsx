/**
 * Language Selector Component
 *
 * Dropdown for selecting target translation language.
 * Shows language flags and names.
 */

import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import type { MultilingualService, Language } from '../services/multilingual.js';

interface LanguageSelectorProps {
  service: MultilingualService;
  onChange?: (lang: Language) => void;
  compact?: boolean;
}

export function LanguageSelector({ service, onChange, compact = false }: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState<Language | undefined>(
    service.getCurrentLanguage()
  );

  useEffect(() => {
    const unsubscribe = service.onUpdate((config) => {
      setCurrentLang(service.getCurrentLanguage());
    });
    return unsubscribe;
  }, [service]);

  const handleSelect = useCallback((lang: Language) => {
    service.setTargetLanguage(lang.code);
    onChange?.(lang);
    setIsOpen(false);
  }, [service, onChange]);

  const languages = service.getSupportedLanguages();

  if (compact) {
    return (
      <div class="language-selector-compact">
        <button
          class="lang-button-compact"
          onClick={() => setIsOpen(!isOpen)}
          title="Select language"
        >
          <span class="lang-flag">{currentLang?.flag}</span>
        </button>
        
        {isOpen && (
          <div class="lang-dropdown-compact">
            {languages.map(lang => (
              <button
                key={lang.code}
                class={`lang-option ${currentLang?.code === lang.code ? 'active' : ''}`}
                onClick={() => handleSelect(lang)}
              >
                <span class="lang-flag">{lang.flag}</span>
                <span class="lang-name">{lang.nativeName}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div class="language-selector">
      <label class="lang-label">
        <span class="lang-label-text">Display Language</span>
        <button
          class="lang-button"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span class="lang-flag">{currentLang?.flag}</span>
          <span class="lang-name">{currentLang?.name || 'Select'}</span>
          <span class="lang-arrow">{isOpen ? '▲' : '▼'}</span>
        </button>
      </label>

      {isOpen && (
        <div class="lang-dropdown">
          <div class="lang-search">
            <input
              type="text"
              placeholder="Search language..."
              class="lang-search-input"
            />
          </div>
          <div class="lang-list">
            {languages.map(lang => (
              <button
                key={lang.code}
                class={`lang-option ${currentLang?.code === lang.code ? 'active' : ''}`}
                onClick={() => handleSelect(lang)}
              >
                <span class="lang-flag">{lang.flag}</span>
                <div class="lang-info">
                  <span class="lang-name">{lang.name}</span>
                  <span class="lang-native">{lang.nativeName}</span>
                </div>
                {currentLang?.code === lang.code && (
                  <span class="lang-check">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .language-selector {
          position: relative;
        }

        .lang-label {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .lang-label-text {
          font-size: 12px;
          color: var(--text-muted, #888);
        }

        .lang-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: var(--bg-secondary, #1a1a2e);
          border: 1px solid var(--border-color, #2a2a3e);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .lang-button:hover {
          border-color: var(--accent, #3b82f6);
        }

        .lang-flag {
          font-size: 18px;
        }

        .lang-name {
          color: var(--text-primary, #fff);
          font-size: 14px;
        }

        .lang-arrow {
          margin-left: auto;
          color: var(--text-muted, #888);
          font-size: 10px;
        }

        .lang-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 4px;
          width: 240px;
          max-height: 320px;
          background: var(--bg-secondary, #1a1a2e);
          border: 1px solid var(--border-color, #2a2a3e);
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          z-index: 1000;
          overflow: hidden;
        }

        .lang-search {
          padding: 8px;
          border-bottom: 1px solid var(--border-color, #2a2a3e);
        }

        .lang-search-input {
          width: 100%;
          padding: 6px 10px;
          background: var(--bg-tertiary, #0f0f1a);
          border: 1px solid var(--border-color, #2a2a3e);
          border-radius: 4px;
          color: var(--text-primary, #fff);
          font-size: 13px;
        }

        .lang-search-input:focus {
          outline: none;
          border-color: var(--accent, #3b82f6);
        }

        .lang-list {
          max-height: 240px;
          overflow-y: auto;
          padding: 4px;
        }

        .lang-option {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          background: none;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .lang-option:hover {
          background: var(--bg-tertiary, #0f0f1a);
        }

        .lang-option.active {
          background: rgba(59, 130, 246, 0.1);
        }

        .lang-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .lang-name {
          color: var(--text-primary, #fff);
          font-size: 14px;
        }

        .lang-native {
          color: var(--text-muted, #888);
          font-size: 12px;
        }

        .lang-check {
          color: var(--accent, #3b82f6);
          font-size: 14px;
        }

        /* Compact variant */
        .language-selector-compact {
          position: relative;
        }

        .lang-button-compact {
          padding: 6px;
          background: var(--bg-secondary, #1a1a2e);
          border: 1px solid var(--border-color, #2a2a3e);
          border-radius: 6px;
          cursor: pointer;
          font-size: 18px;
          transition: all 0.2s;
        }

        .lang-button-compact:hover {
          border-color: var(--accent, #3b82f6);
        }

        .lang-dropdown-compact {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 4px;
          width: 160px;
          max-height: 280px;
          overflow-y: auto;
          background: var(--bg-secondary, #1a1a2e);
          border: 1px solid var(--border-color, #2a2a3e);
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          z-index: 1000;
        }

        .lang-option {
          padding: 8px 10px;
        }
      `}</style>
    </div>
  );
}
