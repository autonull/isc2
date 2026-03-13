/**
 * Match Indicator Component
 */

import { h, Fragment } from 'preact';
import { discoverStyles as styles } from '../styles/Discover.css.js';

interface MatchIndicatorProps {
  similarity: number;
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const SIZE_MAP = {
  small: { fontSize: '12px', bars: '10px' },
  medium: { fontSize: '14px', bars: '14px' },
  large: { fontSize: '18px', bars: '20px' },
};

export function MatchIndicator({
  similarity,
  showLabel = true,
  size = 'medium',
}: MatchIndicatorProps) {
  const signalBars = formatSignalBars(similarity);
  const percentage = (similarity * 100).toFixed(0);
  const label = getProximityLabel(similarity);
  const sizeStyles = SIZE_MAP[size];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span
        style={{
          fontSize: sizeStyles.bars,
          letterSpacing: '2px',
          fontWeight: 'bold',
        }}
      >
        {signalBars}
      </span>
      {showLabel && (
        <>
          <span style={{ fontSize: sizeStyles.fontSize, fontWeight: 'bold' }}>
            {percentage}%
          </span>
          <span
            style={{
              fontSize: '12px',
              color: '#657786',
              textTransform: 'uppercase',
            }}
          >
            {label}
          </span>
        </>
      )}
    </div>
  );
}

function formatSignalBars(similarity: number): string {
  if (similarity >= 0.85) return '▐▌▐▌▐';
  if (similarity >= 0.70) return '▐▌▐▌░';
  if (similarity >= 0.55) return '▐▌░░░';
  return '░░░░░';
}

function getProximityLabel(similarity: number): string {
  if (similarity >= 0.85) return 'VERY CLOSE';
  if (similarity >= 0.70) return 'NEARBY';
  if (similarity >= 0.55) return 'ORBITING';
  return 'DISTANT';
}
