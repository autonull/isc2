/**
 * ZK Proximity Proofs Research Notes
 *
 * @remarks
 * This is a RESEARCH TRACK implementation. Production use requires:
 * - Proper ZK-SNARK/STARK cryptographic primitives
 * - Trusted setup for SNARK parameters
 * - Extensive security auditing
 * - Performance optimization for browser environments
 */

export const RESEARCH_NOTES = {
  limitations: [
    'Current implementation uses simplified proof scheme, not cryptographically secure',
    'Production requires ZK-SNARK/STARK implementation (e.g., Circom + SnarkJS)',
    'Trusted setup needed for SNARK parameters',
    'Performance may be prohibitive for real-time browser use',
    'Embedding dimension reduction may be needed for efficiency',
  ],
  futureWork: [
    'Implement proper R1CS constraint system for cosine similarity',
    'Add support for batch proof verification',
    'Explore STARKs for transparent (no trusted setup) proofs',
    'Investigate recursive proofs for proof aggregation',
    'Optimize for WASM execution in browsers',
  ],
  securityConsiderations: [
    'Current implementation should NOT be used for security-critical applications',
    'Side-channel attacks possible through timing analysis',
    'Random number generation quality affects security',
    'Embedding leakage through repeated proofs needs analysis',
  ],
} as const;

export type ResearchNotes = typeof RESEARCH_NOTES;

/**
 * Get research notes
 */
export function getResearchNotes(): ResearchNotes {
  return RESEARCH_NOTES;
}
