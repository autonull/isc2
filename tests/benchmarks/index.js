const PERFORMANCE_BUDGETS = {
    'model-load': 2000,
    'memory-usage': 150 * 1024 * 1024,
    'embedding-compute': 100,
    'lsh-hash': 10,
    'cosine-similarity': 1,
};
export async function runBenchmark(config) {
    const warmupRuns = config.warmupRuns ?? 3;
    const benchmarkRuns = config.benchmarkRuns ?? 10;
    const times = [];
    for (let i = 0; i < warmupRuns; i++) {
        await config.fn();
    }
    for (let i = 0; i < benchmarkRuns; i++) {
        const start = performance.now();
        await config.fn();
        const end = performance.now();
        times.push(end - start);
    }
    const sorted = [...times].sort((a, b) => a - b);
    const meanMs = times.reduce((a, b) => a + b, 0) / times.length;
    const medianMs = sorted[Math.floor(sorted.length / 2)];
    const minMs = sorted[0];
    const maxMs = sorted[sorted.length - 1];
    const variance = times.reduce((sum, t) => sum + (t - meanMs) ** 2, 0) / times.length;
    const stdDev = Math.sqrt(variance);
    const budget = PERFORMANCE_BUDGETS[config.name] ?? 1000;
    const regressionPercent = ((meanMs - budget) / budget) * 100;
    return {
        name: config.name,
        runs: benchmarkRuns,
        meanMs,
        medianMs,
        minMs,
        maxMs,
        stdDev,
        regressionPercent,
    };
}
export function checkPerformanceBudget(result, threshold = 10) {
    if (result.regressionPercent > threshold) {
        console.warn(`Performance regression detected: ${result.name} is ${result.regressionPercent.toFixed(1)}% slower than budget`);
        return false;
    }
    return true;
}
export async function runBenchmarks(configs) {
    const results = [];
    let passed = true;
    for (const config of configs) {
        const result = await runBenchmark(config);
        results.push(result);
        if (!checkPerformanceBudget(result)) {
            passed = false;
        }
    }
    return { results, passed };
}
//# sourceMappingURL=index.js.map