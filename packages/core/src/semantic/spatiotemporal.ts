/**
 * Location representation for spatiotemporal matching.
 */
export interface Location {
  lat: number;
  lon: number;
  radius?: number; // in kilometers
}

/**
 * Time window representation for spatiotemporal matching.
 */
export interface TimeWindow {
  start: number; // Unix timestamp
  end: number; // Unix timestamp
}

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Computes the great-circle distance between two points on Earth using the Haversine formula.
 *
 * @param lat1 - Latitude of first point (degrees)
 * @param lon1 - Longitude of first point (degrees)
 * @param lat2 - Latitude of second point (degrees)
 * @param lon2 - Longitude of second point (degrees)
 * @returns Distance in kilometers
 *
 * @example
 * ```typescript
 * // Tokyo to Osaka
 * haversineDistance(35.6895, 139.6917, 34.6937, 135.5023); // ~403 km
 * ```
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const sinDLat2 = Math.sin(dLat / 2) ** 2;
  const sinDLon2 = Math.sin(dLon / 2) ** 2;

  const a = sinDLat2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinDLon2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

const DEFAULT_RADIUS_KM = 50;

/**
 * Computes location overlap score between two locations.
 *
 * @param a - First location
 * @param b - Second location
 * @returns Overlap score in [0, 1], where 1 = identical, 0 = no overlap
 */
export function locationOverlap(a: Location, b: Location): number {
  const distance = haversineDistance(a.lat, a.lon, b.lat, b.lon);
  const radiusA = a.radius ?? DEFAULT_RADIUS_KM;
  const radiusB = b.radius ?? DEFAULT_RADIUS_KM;
  const maxRadius = Math.max(radiusA, radiusB);

  if (distance === 0) return 1;
  if (distance >= radiusA + radiusB) return 0;

  return Math.max(0, Math.min(1, 1 - distance / maxRadius));
}

/**
 * Computes time window overlap score.
 *
 * @param a - First time window
 * @param b - Second time window
 * @returns Overlap score in [0, 1], where 1 = identical, 0 = no overlap
 */
export function timeOverlap(a: TimeWindow, b: TimeWindow): number {
  if (a.end <= b.start || b.end <= a.start) return 0;

  const overlapStart = Math.max(a.start, b.start);
  const overlapEnd = Math.min(a.end, b.end);
  const overlapDuration = overlapEnd - overlapStart;

  const totalStart = Math.min(a.start, b.start);
  const totalEnd = Math.max(a.end, b.end);
  const totalDuration = totalEnd - totalStart;

  return totalDuration === 0 ? 1 : overlapDuration / totalDuration;
}

/**
 * Computes combined spatiotemporal similarity score.
 *
 * @param locationA - First location (optional)
 * @param locationB - Second location (optional)
 * @param timeA - First time window (optional)
 * @param timeB - Second time window (optional)
 * @param locationWeight - Weight for location similarity (default: 0.5)
 * @returns Combined spatiotemporal score in [0, 1]
 */
export function spatiotemporalSimilarity(
  locationA?: Location,
  locationB?: Location,
  timeA?: TimeWindow,
  timeB?: TimeWindow,
  locationWeight: number = 0.5
): number {
  const hasLoc = locationA && locationB;
  const hasTime = timeA && timeB;

  if (!hasLoc && !hasTime) return 0;

  let score = 0;
  let totalWeight = 0;

  if (hasLoc) {
    score += locationOverlap(locationA!, locationB!) * locationWeight;
    totalWeight += locationWeight;
  }

  if (hasTime) {
    const timeWeight = 1 - locationWeight;
    score += timeOverlap(timeA!, timeB!) * timeWeight;
    totalWeight += timeWeight;
  }

  return score / totalWeight;
}
