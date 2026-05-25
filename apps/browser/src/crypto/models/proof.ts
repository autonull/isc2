/* eslint-disable */
export type Embedding = number[];

export interface ProofData {
  protocol: string;
  publicInputs: Uint8Array;
  proof: Uint8Array;
  verificationKeyHash: string;
}

export interface ProximityProof {
  id: string;
  prover: string;
  commitmentA: Uint8Array;
  commitmentB: Uint8Array;
  proofData: ProofData;
  threshold: number;
  actualSimilarity: number;
  verified: boolean;
  createdAt: number;
}

export interface SerializableProof {
  id: string;
  commitmentA: number[];
  commitmentB: number[];
  proofData: {
    protocol: string;
    publicInputs: number[];
    proof: number[];
    verificationKeyHash: string;
  };
  threshold: number;
  verified: boolean;
  createdAt: number;
}

export interface VerificationResult {
  valid: boolean;
  similarityRange: { min: number; max: number };
  confidence: number;
  error?: string;
}

export interface EmbeddingCommitment {
  id: string;
  commitment: string;
  salt: string;
  createdAt: number;
  metadata?: {
    channelId?: string;
    contentHash?: string;
  };
}
