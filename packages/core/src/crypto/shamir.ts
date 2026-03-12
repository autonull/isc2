export interface SecretShare {
  id: number;
  x: number;
  y: Uint8Array;
  threshold: number;
  total: number;
  metadata?: { createdAt: number; purpose?: string };
}

export interface ShamirConfig {
  prime: number;
  defaultThreshold: number;
  defaultTotal: number;
}

const DEFAULT_PRIME = 257;
const DEFAULT_CONFIG: ShamirConfig = { prime: DEFAULT_PRIME, defaultThreshold: 3, defaultTotal: 5 };

function evaluatePolynomial(coefficients: number[], x: number, prime: number): number {
  let result = 0;
  for (let i = coefficients.length - 1; i >= 0; i--) {
    result = (result * x + coefficients[i]) % prime;
  }
  return result;
}

function generatePolynomial(secret: number, degree: number, prime: number): number[] {
  const coefficients = [secret % prime];
  for (let i = 1; i <= degree; i++) {
    coefficients.push(Math.floor(Math.random() * (prime - 1)) + 1);
  }
  return coefficients;
}

function splitByte(byte: number, threshold: number, total: number, prime: number): { x: number; y: number }[] {
  const polynomial = generatePolynomial(byte, threshold - 1, prime);
  return Array.from({ length: total }, (_, i) => ({ x: i + 1, y: evaluatePolynomial(polynomial, i + 1, prime) }));
}

function lagrangeInterpolate(shares: { x: number; y: number }[], prime: number): number {
  let secret = 0;

  for (let i = 0; i < shares.length; i++) {
    let numerator = 1;
    let denominator = 1;

    for (let j = 0; j < shares.length; j++) {
      if (i !== j) {
        numerator = (numerator * (0 - shares[j].x + prime)) % prime;
        denominator = (denominator * (shares[i].x - shares[j].x + prime)) % prime;
      }
    }

    let denomInverse = 1;
    let exp = prime - 2;
    let base = denominator;
    while (exp > 0) {
      if (exp % 2 === 1) denomInverse = (denomInverse * base) % prime;
      base = (base * base) % prime;
      exp = Math.floor(exp / 2);
    }

    const term = (shares[i].y * numerator * denomInverse) % prime;
    secret = (secret + term + prime) % prime;
  }

  return secret;
}

export function splitSecret(
  secret: Uint8Array,
  threshold: number,
  total: number,
  config: ShamirConfig = DEFAULT_CONFIG
): SecretShare[] {
  if (threshold > total) throw new Error('Threshold cannot exceed total shares');
  if (threshold < 1) throw new Error('Threshold must be at least 1');
  if (secret.length === 0) throw new Error('Secret cannot be empty');

  const prime = config.prime;
  const shares: SecretShare[] = Array.from({ length: total }, (_, i) => ({
    id: i + 1,
    x: i + 1,
    y: new Uint8Array(secret.length),
    threshold,
    total,
    metadata: { createdAt: Date.now() },
  }));

  for (let byteIndex = 0; byteIndex < secret.length; byteIndex++) {
    const byteShares = splitByte(secret[byteIndex], threshold, total, prime);
    for (let shareIndex = 0; shareIndex < total; shareIndex++) {
      shares[shareIndex].y[byteIndex] = byteShares[shareIndex].y;
    }
  }

  return shares;
}

export function reconstructSecret(shares: SecretShare[], config: ShamirConfig = DEFAULT_CONFIG): Uint8Array {
  if (shares.length === 0) throw new Error('No shares provided');

  const threshold = shares[0].threshold;
  const secretLength = shares[0].y.length;

  if (shares.length < threshold) {
    throw new Error(`Insufficient shares: have ${shares.length}, need ${threshold}`);
  }

  for (const share of shares) {
    if (share.threshold !== threshold) throw new Error('All shares must have the same threshold');
    if (share.y.length !== secretLength) throw new Error('All shares must have the same length');
  }

  const prime = config.prime;
  const secret = new Uint8Array(secretLength);

  for (let byteIndex = 0; byteIndex < secretLength; byteIndex++) {
    const byteShares = shares.map((share) => ({ x: share.x, y: share.y[byteIndex] }));
    secret[byteIndex] = lagrangeInterpolate(byteShares, prime);
  }

  return secret;
}

export function exportShare(share: SecretShare): object {
  return { id: share.id, x: share.x, y: Array.from(share.y), threshold: share.threshold, total: share.total, metadata: share.metadata };
}

export function importShare(data: object): SecretShare {
  const d = data as Record<string, unknown>;
  return {
    id: d.id as number,
    x: d.x as number,
    y: new Uint8Array(d.y as number[]),
    threshold: d.threshold as number,
    total: d.total as number,
    metadata: d.metadata as SecretShare['metadata'],
  };
}

export function exportShares(shares: SecretShare[]): object[] {
  return shares.map(exportShare);
}

export function importShares(data: object[]): SecretShare[] {
  return data.map(importShare);
}

export function validateShares(shares: SecretShare[]): {
  valid: boolean;
  errors: string[];
  threshold: number;
  canReconstruct: boolean;
} {
  const errors: string[] = [];

  if (shares.length === 0) {
    return { valid: false, errors: ['No shares provided'], threshold: 0, canReconstruct: false };
  }

  const threshold = shares[0].threshold;
  const total = shares[0].total;
  const length = shares[0].y.length;

  for (const share of shares) {
    if (share.threshold !== threshold) errors.push(`Share ${share.id} has different threshold`);
    if (share.total !== total) errors.push(`Share ${share.id} has different total`);
    if (share.y.length !== length) errors.push(`Share ${share.id} has different length`);
    if (share.x < 1 || share.x > total) errors.push(`Share ${share.id} has invalid x value`);
  }

  const xValues = new Set(shares.map((s) => s.x));
  if (xValues.size !== shares.length) errors.push('Duplicate shares detected');

  return {
    valid: errors.length === 0,
    errors,
    threshold,
    canReconstruct: shares.length >= threshold && errors.length === 0,
  };
}

export async function createKeyBackup(
  privateKeyBytes: Uint8Array,
  threshold: number = 3,
  total: number = 5,
  options?: { purpose?: string }
): Promise<SecretShare[]> {
  const shares = splitSecret(privateKeyBytes, threshold, total);
  if (options?.purpose) {
    for (const share of shares) {
      if (share.metadata) share.metadata.purpose = options.purpose;
    }
  }
  return shares;
}

export function recoverKeyFromBackup(shares: SecretShare[]): Uint8Array {
  return reconstructSecret(shares);
}

export function generateRecoveryCodes(shares: SecretShare[]): string[] {
  return shares.map((share) => {
    const yHex = Array.from(share.y).map((b) => b.toString(16).padStart(2, '0')).join('');
    return `ISC-${share.id.toString().padStart(2, '0')}-${share.threshold}-${share.total}-${yHex.slice(0, 16)}...`;
  });
}

export function verifyShareIntegrity(share: SecretShare): boolean {
  return share.id > 0 && share.id <= share.total && share.x > 0 && share.x <= share.total && share.y.length > 0 && share.threshold <= share.total;
}
