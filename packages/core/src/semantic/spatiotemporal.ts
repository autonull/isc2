/* eslint-disable */
export interface Location {
  lat: number;
  lon: number;
  radius?: number;
}

export interface TimeWindow {
  start: number;
  end: number;
}

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number): number => (deg * Math.PI) / 180;
const DEFAULT_RADIUS_KM = 50;

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);

  const sinDLat2 = Math.sin(dLat / 2) ** 2;
  const sinDLon2 = Math.sin(dLon / 2) ** 2;

  const a = sinDLat2 + Math.cos(lat1Rad) * Math.cos(lat2Rad) * sinDLon2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

export function locationOverlap(a: Location, b: Location): number {
  const distance = haversineDistance(a.lat, a.lon, b.lat, b.lon);
  const radiusA = a.radius ?? DEFAULT_RADIUS_KM;
  const radiusB = b.radius ?? DEFAULT_RADIUS_KM;
  const maxRadius = Math.max(radiusA, radiusB);

  if (distance === 0) {return 1;}
  if (distance >= radiusA + radiusB) {return 0;}

  return Math.max(0, Math.min(1, 1 - distance / maxRadius));
}

export function timeOverlap(a: TimeWindow, b: TimeWindow): number {
  if (a.end <= b.start || b.end <= a.start) {return 0;}

  const overlapStart = Math.max(a.start, b.start);
  const overlapEnd = Math.min(a.end, b.end);
  const overlapDuration = overlapEnd - overlapStart;

  const totalStart = Math.min(a.start, b.start);
  const totalEnd = Math.max(a.end, b.end);
  const totalDuration = totalEnd - totalStart;

  return totalDuration === 0 ? 1 : overlapDuration / totalDuration;
}

export function spatiotemporalSimilarity(
  locationA?: Location,
  locationB?: Location,
  timeA?: TimeWindow,
  timeB?: TimeWindow,
  locationWeight: number = 0.5
): number {
  const hasLoc = !!locationA && !!locationB;
  const hasTime = !!timeA && !!timeB;

  if (!hasLoc && !hasTime) {return 0;}

  let score = 0;
  let totalWeight = 0;

  if (hasLoc) {
    score += locationOverlap(locationA, locationB) * locationWeight;
    totalWeight += locationWeight;
  }

  if (hasTime) {
    const timeWeight = 1 - locationWeight;
    score += timeOverlap(timeA, timeB) * timeWeight;
    totalWeight += timeWeight;
  }

  return score / totalWeight;
}
