/* eslint-disable */
export function getProximityTier(distance: number): number {
  if (distance < 0.1) return 1;
  if (distance < 0.25) return 2;
  if (distance < 0.5) return 3;
  return 4;
}

export function formatProximity(distance: number): string {
  if (distance < 0.1) return 'Very Close';
  if (distance < 0.25) return 'Close';
  if (distance < 0.5) return 'Similar';
  return 'Distant';
}
