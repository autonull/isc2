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

const PERFORMANCE_BUDGETS: Record<string, number> = {
  'model-load': 2000,
  'memory-usage': 150 * 1024 * 1024,
  'embedding-compute': 100,
  'lsh-hash': 10,
  'cosine-similarity': 1,
};

export async function runBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult> {
  const warmupRuns = config.warmupRuns ?? 3;
  const benchmarkRuns = config.benchmarkRuns ?? 10;
  const times: number[] = [];

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

export function checkPerformanceBudget(result: BenchmarkResult, threshold: number = 10): boolean {
  if (result.regressionPercent > threshold) {
    console.warn(
      `Performance regression detected: ${result.name} is ${result.regressionPercent.toFixed(1)}% slower than budget`
    );
    return false;
  }
  return true;
}

export async function runBenchmarks(
  configs: BenchmarkConfig[]
): Promise<{ results: BenchmarkResult[]; passed: boolean }> {
  const results: BenchmarkResult[] = [];
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
