/* eslint-disable */
/**
 * Vector Math Utilities
 */

export interface Vector2D {
  x: number;
  y: number;
}

/**
 * Compute vector magnitude
 */
export function magnitude(vec: Vector2D): number {
  return Math.sqrt(vec.x * vec.x + vec.y * vec.y);
}

/**
 * Normalize vector to unit length
 */
export function normalize(vec: Vector2D): Vector2D {
  const mag = magnitude(vec);
  if (mag === 0) return { x: 0, y: 0 };
  return { x: vec.x / mag, y: vec.y / mag };
}

/**
 * Compute distance between two points
 */
export function distance(a: Vector2D, b: Vector2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Compute squared distance (faster, no sqrt)
 */
export function squaredDistance(a: Vector2D, b: Vector2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

/**
 * Scale vector by factor
 */
export function scale(vec: Vector2D, factor: number): Vector2D {
  return { x: vec.x * factor, y: vec.y * factor };
}

/**
 * Add two vectors
 */
export function add(a: Vector2D, b: Vector2D): Vector2D {
  return { x: a.x + b.x, y: a.y + b.y };
}

/**
 * Subtract two vectors
 */
export function subtract(a: Vector2D, b: Vector2D): Vector2D {
  return { x: a.x - b.x, y: a.y - b.y };
}

/**
 * Compute dot product
 */
export function dot(a: Vector2D, b: Vector2D): number {
  return a.x * b.x + a.y * b.y;
}

/**
 * Compute centroid of points
 */
export function centroid(points: Vector2D[]): Vector2D {
  if (points.length === 0) return { x: 0, y: 0 };
  
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  
  return {
    x: sum.x / points.length,
    y: sum.y / points.length,
  };
}
