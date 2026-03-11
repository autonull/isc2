export const TEST_SEEDS = {
  lsh: 'lsh-test-seed-2024',
  sampling: 'sampling-test-seed-2024',
  matching: 'matching-test-seed-2024',
  vectors: 'vector-fixture-seed-2024',
  crypto: 'crypto-test-seed-2024',
} as const;

export type TestSeedName = keyof typeof TEST_SEEDS;

export function getTestSeed(name: TestSeedName): string {
  return TEST_SEEDS[name];
}
