/**
 * Peer List Component
 */

import { h } from 'preact';
import { PeerCard } from './PeerCard.js';
import type { Match } from '../types/discover.js';

interface PeerListProps {
  matches: Match[];
  onDial: (match: Match) => void;
  emptyMessage?: string;
}

export function PeerList({
  matches,
  onDial,
  emptyMessage = 'No matches found',
}: PeerListProps) {
  if (matches.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', color: '#657786' }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div>
      {matches.map((match) => (
        <PeerCard key={match.peerId} match={match} onDial={onDial} />
      ))}
    </div>
  );
}
