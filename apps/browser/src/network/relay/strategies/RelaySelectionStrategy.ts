/**
 * Relay Selection Strategy Interface
 */

import type { RelayCandidate } from '../types/relay.js';

export interface RelaySelectionStrategy {
  select(candidates: RelayCandidate[]): RelayCandidate | undefined;
  rank(candidates: RelayCandidate[]): RelayCandidate[];
}
