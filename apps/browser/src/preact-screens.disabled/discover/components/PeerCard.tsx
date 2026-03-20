/**
 * Peer Card Component
 */

import { h } from 'preact';
import { discoverStyles as styles } from '../styles/Discover.css.js';
import type { Match } from '../types/discover.js';

interface PeerCardProps {
  match: Match;
  onDial: (match: Match) => void;
}

export function PeerCard({ match, onDial }: PeerCardProps) {
  const signalBars = formatSignalBars(match.similarity);
  const timeAgo = formatTimeAgo(match.updatedAt);

  return (
    <div style={styles.matchCard}>
      <div style={styles.matchHeader}>
        <span style={styles.similarity}>
          {signalBars} {(match.similarity * 100).toFixed(0)}%
        </span>
        <span style={styles.meta}>{timeAgo}</span>
      </div>
      {match.description && (
        <p style={styles.description}>{match.description}</p>
      )}
      <div style={styles.meta}>
        <span>Peer {match.peerId.slice(0, 8)}...</span>
        {match.relTag && <span>• {match.relTag}</span>}
      </div>
      <button
        style={{ ...styles.actionBtn, marginTop: '12px' }}
        onClick={() => onDial(match)}
      >
        Start Chat
      </button>
    </div>
  );
}

function formatSignalBars(similarity: number): string {
  if (similarity >= 0.85) return '▐▌▐▌▐';
  if (similarity >= 0.70) return '▐▌▐▌░';
  if (similarity >= 0.55) return '▐▌░░░';
  return '░░░░░';
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
