/**
 * Performance Benchmarks
 *
 * Measures key performance metrics:
 * - Match discovery time
 * - Message delivery latency
 * - Bundle size tracking
 * - Memory usage
 */
interface BenchmarkResult {
    name: string;
    value: number;
    unit: string;
    timestamp: number;
    passed: boolean;
    target: number;
}
/**
 * Benchmark: Time to First Match
 * Measures how long it takes to find the first match after query
 */
export declare function benchmarkMatchDiscovery(): Promise<BenchmarkResult>;
/**
 * Benchmark: Message Delivery Latency
 * Measures round-trip time for message delivery
 */
export declare function benchmarkMessageDelivery(): Promise<BenchmarkResult>;
/**
 * Benchmark: Bundle Size
 * Checks current bundle size against target
 */
export declare function benchmarkBundleSize(): Promise<BenchmarkResult>;
/**
 * Benchmark: Memory Usage
 * Measures current memory consumption
 */
export declare function benchmarkMemoryUsage(): BenchmarkResult;
/**
 * Run all benchmarks
 */
export declare function runAllBenchmarks(): Promise<BenchmarkResult[]>;
/**
 * Export results as JSON for CI/CD
 */
export declare function exportBenchmarkResults(results: BenchmarkResult[]): string;
/**
 * Save results to localStorage for tracking
 */
export declare function saveBenchmarkResults(results: BenchmarkResult[]): void;
/**
 * Get benchmark history for trend analysis
 */
export declare function getBenchmarkHistory(): Array<{
    timestamp: number;
    results: BenchmarkResult[];
}>;
/**
 * Clear benchmark history
 */
export declare function clearBenchmarkHistory(): void;
export {};
//# sourceMappingURL=performance.bench.d.ts.map