export declare const TEST_SEEDS: {
    readonly lsh: "lsh-test-seed-2024";
    readonly sampling: "sampling-test-seed-2024";
    readonly matching: "matching-test-seed-2024";
    readonly vectors: "vector-fixture-seed-2024";
    readonly crypto: "crypto-test-seed-2024";
};
export type TestSeedName = keyof typeof TEST_SEEDS;
export declare function getTestSeed(name: TestSeedName): string;
//# sourceMappingURL=seeds.d.ts.map