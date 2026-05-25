/* eslint-disable */
/**
 * Quality Calculator Utilities
 *
 * Pure functions for calculating connection and relay quality scores.
 */

import { QUALITY_WEIGHTS, RELAY_CONSTANTS } from '../config/relayConfig.ts';

/**
 * Calculate connection quality score from metrics
 */
export function calculateConnectionQuality(
  latency: number,
  packetLoss: number,
  jitter: number,
  bandwidth: number
): number {
  const latencyScore = Math.max(0, 1 - latency / 500);
  const packetLossScore = Math.max(0, 1 - packetLoss * 10);
  const jitterScore = Math.max(0, 1 - jitter / 100);
  const bandwidthScore = Math.min(1, bandwidth / 1000);

  return (
    latencyScore * QUALITY_WEIGHTS.LATENCY +
    packetLossScore * QUALITY_WEIGHTS.PACKET_LOSS +
    jitterScore * QUALITY_WEIGHTS.JITTER +
    bandwidthScore * QUALITY_WEIGHTS.BANDWIDTH
  );
}

/**
 * Calculate relay quality score
 */
export function calculateRelayQualityScore(
  latency: number,
  successRate: number,
  usageCount: number,
  weights: { latency: number; successRate: number; stability: number }
): number {
  const latencyScore = Math.max(0, 1 - latency / RELAY_CONSTANTS.MAX_LATENCY_MS);
  const successScore = successRate;
  const stabilityScore =
    usageCount > RELAY_CONSTANTS.STABILITY_THRESHOLD_USES
      ? RELAY_CONSTANTS.STABILITY_MAX_SCORE
      : usageCount / RELAY_CONSTANTS.STABILITY_THRESHOLD_USES;

  return (
    latencyScore * weights.latency +
    successScore * weights.successRate +
    stabilityScore * weights.stability
  );
}

/**
 * Smooth a value with exponential moving average
 */
export function smoothValue(
  current: number,
  newValue: number,
  factor: number = RELAY_CONSTANTS.CONNECTION_SMOOTHING
): number {
  return current * (1 - factor) + newValue * factor;
}

/**
 * Check if quality score is acceptable
 */
export function isAcceptable(score: number, threshold: number): boolean {
  return score >= threshold;
}

/**
 * Check if quality score is degraded
 */
export function isDegraded(score: number, threshold: number): boolean {
  return score < threshold;
}
