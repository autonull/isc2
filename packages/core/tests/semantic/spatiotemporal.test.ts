import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  locationOverlap,
  timeOverlap,
  spatiotemporalSimilarity,
} from '../../src/semantic/spatiotemporal.js';
import { LOCATIONS, TIME_WINDOWS } from '../fixtures/vectors.js';

describe('haversineDistance', () => {
  it('should return 0 for same location', () => {
    const dist = haversineDistance(35.6762, 139.6503, 35.6762, 139.6503);
    expect(dist).toBeCloseTo(0, 5);
  });

  it('should compute correct distance between Tokyo and Osaka', () => {
    const dist = haversineDistance(35.6895, 139.6917, 34.6937, 135.5023);
    // Known distance is approximately 396-403 km
    expect(dist).toBeGreaterThan(390);
    expect(dist).toBeLessThan(410);
  });

  it('should be symmetric', () => {
    const distAB = haversineDistance(35.6895, 139.6917, 34.6937, 135.5023);
    const distBA = haversineDistance(34.6937, 135.5023, 35.6895, 139.6917);
    expect(distAB).toBeCloseTo(distBA, 5);
  });

  it('should handle antipodal points', () => {
    // North pole to South pole
    const dist = haversineDistance(90, 0, -90, 0);
    // Half Earth's circumference
    expect(dist).toBeCloseTo(20015, 0);
  });
});

describe('locationOverlap', () => {
  it('should return 1.0 for identical locations', () => {
    const overlap = locationOverlap(LOCATIONS.tokyo, LOCATIONS.tokyo);
    expect(overlap).toBe(1.0);
  });

  it('should return 0.0 for far apart locations', () => {
    const overlap = locationOverlap(LOCATIONS.tokyo, LOCATIONS.farAway);
    expect(overlap).toBe(0.0);
  });

  it('should compute partial overlap correctly', () => {
    // Tokyo to Shibuya is about 3km
    const overlap = locationOverlap(LOCATIONS.tokyo, LOCATIONS.shibuya);
    // With 50km and 10km radius, should have significant overlap
    expect(overlap).toBeGreaterThan(0.5);
    expect(overlap).toBeLessThan(1.0);
  });

  it('should handle custom radius', () => {
    const locA = { lat: 35.6762, lon: 139.6503, radius: 100 };
    const locB = { lat: 35.6762, lon: 139.6503, radius: 100 };

    expect(locationOverlap(locA, locB)).toBe(1.0);
  });

  it('should use default radius when not specified', () => {
    const locA = { lat: 35.6762, lon: 139.6503 };
    const locB = { lat: 35.6762, lon: 139.6503 };

    // Default radius is 50km
    expect(locationOverlap(locA, locB)).toBe(1.0);
  });
});

describe('timeOverlap', () => {
  it('should return 1.0 for identical time windows', () => {
    const overlap = timeOverlap(TIME_WINDOWS.now, TIME_WINDOWS.now);
    expect(overlap).toBe(1.0);
  });

  it('should return 0.0 for non-overlapping windows', () => {
    const overlap = timeOverlap(TIME_WINDOWS.now, TIME_WINDOWS.farFuture);
    expect(overlap).toBe(0.0);
  });

  it('should compute partial overlap correctly', () => {
    const windowA = { start: 0, end: 100 };
    const windowB = { start: 50, end: 150 };

    const overlap = timeOverlap(windowA, windowB);
    // Overlap is 50, total is 150
    expect(overlap).toBeCloseTo(50 / 150, 2);
  });

  it('should handle edge cases', () => {
    // Adjacent windows (touching but not overlapping)
    const windowA = { start: 0, end: 50 };
    const windowB = { start: 50, end: 100 };

    expect(timeOverlap(windowA, windowB)).toBe(0);
  });
});

describe('spatiotemporalSimilarity', () => {
  it('should return 0 when neither location nor time provided', () => {
    expect(spatiotemporalSimilarity()).toBe(0);
  });

  it('should return location-only score when only locations provided', () => {
    const score = spatiotemporalSimilarity(LOCATIONS.tokyo, LOCATIONS.tokyo);
    expect(score).toBe(1.0);
  });

  it('should return time-only score when only time provided', () => {
    const score = spatiotemporalSimilarity(
      undefined,
      undefined,
      TIME_WINDOWS.now,
      TIME_WINDOWS.now
    );
    expect(score).toBe(1.0);
  });

  it('should combine location and time with default weights', () => {
    const score = spatiotemporalSimilarity(
      LOCATIONS.tokyo,
      LOCATIONS.tokyo,
      TIME_WINDOWS.now,
      TIME_WINDOWS.now
    );
    // Both are 1.0, weighted 50/50 = 1.0
    expect(score).toBe(1.0);
  });

  it('should respect custom location weight', () => {
    const score = spatiotemporalSimilarity(
      LOCATIONS.tokyo,
      LOCATIONS.shibuya,
      TIME_WINDOWS.now,
      TIME_WINDOWS.now,
      0.8 // 80% weight on location
    );

    const locScore = locationOverlap(LOCATIONS.tokyo, LOCATIONS.shibuya);
    // Time is 1.0, weighted average with 0.8 location weight
    expect(score).toBeCloseTo(locScore * 0.8 + 0.2, 2);
  });
});
