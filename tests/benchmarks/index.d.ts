export interface BenchmarkResult {
    name: string;
    runs: number;
    meanMs: number;
    medianMs: number;
    minMs: number;
    maxMs: number;
    stdDev: number;
    regressionPercent: number;
}
export interface BenchmarkConfig {
    name: string;
    fn: () => Promise<void> | void;
    warmupRuns?: number;
    benchmarkRuns?: number;
    timeout?: number;
}
export declare function runBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult>;
export declare function checkPerformanceBudget(result: BenchmarkResult, threshold?: number): boolean;
export declare function runBenchmarks(configs: BenchmarkConfig[]): Promise<{
    results: BenchmarkResult[];
    passed: boolean;
}>;
//# sourceMappingURL=index.d.ts.map