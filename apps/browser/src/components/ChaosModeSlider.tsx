/**
 * Chaos Mode Slider Component
 *
 * UI control for adjusting serendipity/chaos level.
 * Shows preset options and real-time feedback.
 */

import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { CHAOS_PRESETS, type ChaosModeService } from '../services/chaosMode.js';

interface ChaosModeSliderProps {
  service: ChaosModeService;
  onChange?: (level: number) => void;
}

export function ChaosModeSlider({ service, onChange }: ChaosModeSliderProps) {
  const [level, setLevel] = useState(service.getState().chaosLevel);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const unsubscribe = service.onUpdate((state) => {
      setLevel(state.chaosLevel);
    });
    return unsubscribe;
  }, [service]);

  const handleLevelChange = useCallback((e: Event) => {
    const value = parseInt((e.target as HTMLInputElement).value, 10);
    setLevel(value);
    service.setChaosLevel(value);
    onChange?.(value);
  }, [service, onChange]);

  const handlePresetClick = useCallback((presetLevel: number) => {
    setLevel(presetLevel);
    service.setChaosLevel(presetLevel);
    onChange?.(presetLevel);
  }, [service, onChange]);

  const getCurrentPreset = useCallback(() => {
    for (const [key, preset] of Object.entries(CHAOS_PRESETS)) {
      if (Math.abs(preset.level - level) < 10) {
        return { key, ...preset };
      }
    }
    return null;
  }, [level]);

  const currentPreset = getCurrentPreset();
  const isActive = level > 0;

  return (
    <div class={`chaos-mode-slider ${isActive ? 'active' : ''}`}>
      <div class="chaos-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div class="chaos-title">
          <span class="chaos-icon">{isActive ? '🎲' : '🎯'}</span>
          <span class="chaos-label">Chaos Mode</span>
        </div>
        <div class="chaos-value">
          <span class="chaos-percent">{level}%</span>
          {currentPreset && (
            <span class="chaos-preset-name">{currentPreset.label}</span>
          )}
        </div>
        <span class={`chaos-toggle ${isExpanded ? 'expanded' : ''}`}>
          {isExpanded ? '▲' : '▼'}
        </span>
      </div>

      {isExpanded && (
        <div class="chaos-content">
          <div class="chaos-presets">
            {Object.entries(CHAOS_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                class={`chaos-preset-btn ${level === preset.level ? 'active' : ''}`}
                onClick={() => handlePresetClick(preset.level)}
              >
                <span class="preset-name">{preset.label}</span>
                <span class="preset-desc">{preset.description}</span>
              </button>
            ))}
          </div>

          <div class="chaos-slider-container">
            <input
              type="range"
              min="0"
              max="100"
              value={level}
              onInput={handleLevelChange}
              class="chaos-range"
            />
            <div class="chaos-scale">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          <div class="chaos-effects">
            <h4>Active Effects:</h4>
            <ul>
              {level >= 10 && (
                <li class={level >= 10 ? 'active' : ''}>
                  ✓ Similarity threshold reduced
                </li>
              )}
              {level >= 30 && (
                <li class={level >= 30 ? 'active' : ''}>
                  ✓ Topic diversity boost
                </li>
              )}
              {level >= 70 && (
                <li class={level >= 70 ? 'active' : ''}>
                  ✓ Random peer injection
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      <style>{`
        .chaos-mode-slider {
          background: var(--bg-secondary, #1a1a2e);
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--border-color, #2a2a3e);
          transition: all 0.3s ease;
        }

        .chaos-mode-slider.active {
          border-color: var(--accent, #3b82f6);
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.2);
        }

        .chaos-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .chaos-header:hover {
          background: var(--bg-tertiary, #0f0f1a);
        }

        .chaos-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .chaos-icon {
          font-size: 20px;
        }

        .chaos-label {
          font-weight: 600;
          color: var(--text-primary, #fff);
        }

        .chaos-value {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .chaos-percent {
          font-size: 18px;
          font-weight: 700;
          color: var(--accent, #3b82f6);
        }

        .chaos-preset-name {
          font-size: 12px;
          color: var(--text-muted, #888);
          padding: 2px 8px;
          background: var(--bg-tertiary, #0f0f1a);
          border-radius: 4px;
        }

        .chaos-toggle {
          color: var(--text-muted, #888);
          font-size: 12px;
          transition: transform 0.2s;
        }

        .chaos-toggle.expanded {
          transform: rotate(180deg);
        }

        .chaos-content {
          padding: 16px;
          border-top: 1px solid var(--border-color, #2a2a3e);
          background: var(--bg-tertiary, #0f0f1a);
        }

        .chaos-presets {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 8px;
          margin-bottom: 20px;
        }

        .chaos-preset-btn {
          padding: 12px;
          background: var(--bg-secondary, #1a1a2e);
          border: 2px solid transparent;
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
        }

        .chaos-preset-btn:hover {
          background: var(--bg-secondary, #1a1a2e);
          border-color: var(--accent-light, #60a5fa);
        }

        .chaos-preset-btn.active {
          border-color: var(--accent, #3b82f6);
          background: rgba(59, 130, 246, 0.1);
        }

        .preset-name {
          display: block;
          font-weight: 600;
          color: var(--text-primary, #fff);
          margin-bottom: 4px;
        }

        .preset-desc {
          display: block;
          font-size: 11px;
          color: var(--text-muted, #888);
        }

        .chaos-slider-container {
          margin-bottom: 20px;
        }

        .chaos-range {
          width: 100%;
          height: 8px;
          border-radius: 4px;
          background: var(--bg-secondary, #1a1a2e);
          outline: none;
          -webkit-appearance: none;
        }

        .chaos-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--accent, #3b82f6);
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
          transition: transform 0.2s;
        }

        .chaos-range::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }

        .chaos-scale {
          display: flex;
          justify-content: space-between;
          margin-top: 8px;
          font-size: 11px;
          color: var(--text-muted, #888);
        }

        .chaos-effects {
          margin-top: 16px;
        }

        .chaos-effects h4 {
          margin: 0 0 12px;
          font-size: 13px;
          color: var(--text-muted, #888);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .chaos-effects ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .chaos-effects li {
          padding: 8px 0;
          color: var(--text-muted, #888);
          font-size: 13px;
          opacity: 0.5;
          transition: opacity 0.2s;
        }

        .chaos-effects li.active {
          opacity: 1;
          color: var(--text-primary, #fff);
        }
      `}</style>
    </div>
  );
}
