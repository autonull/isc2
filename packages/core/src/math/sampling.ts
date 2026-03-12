import { seededRng } from './rng.js';
import { normalize } from './cosine.js';

export function sampleFromDistribution(
  mu: number[],
  sigma: number,
  n: number,
  rng?: () => number
): number[][] {
  const random = rng ?? seededRng('default-sample-rng');

  return Array.from({ length: n }, () => {
    const sample = new Array<number>(mu.length);

    for (let i = 0; i < mu.length; i += 2) {
      const u1 = random() ?? 1e-10;
      const u2 = random();
      const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);

      sample[i] = mu[i] + sigma * z0;
      if (i + 1 < mu.length) {
        sample[i + 1] = mu[i + 1] + sigma * z1;
      }
    }

    try {
      return normalize(sample);
    } catch {
      return normalize(mu);
    }
  });
}

export function computeMean(samples: number[][]): number[] {
  if (samples.length === 0) {
    throw new Error('Cannot compute mean of empty sample set');
  }

  const dimensions = samples[0].length;
  const sum = new Array(dimensions).fill(0);

  for (const sample of samples) {
    sample.forEach((v, i) => {
      sum[i] += v;
    });
  }

  return sum.map((v) => v / samples.length);
}

export function computeStdDev(samples: number[][], mean: number[]): number[] {
  if (samples.length === 0) {
    throw new Error('Cannot compute std dev of empty sample set');
  }

  const dimensions = samples[0].length;
  const variance = new Array(dimensions).fill(0);

  for (const sample of samples) {
    sample.forEach((v, i) => {
      const diff = v - mean[i];
      variance[i] += diff * diff;
    });
  }

  return variance.map((v) => Math.sqrt(v / samples.length));
}
